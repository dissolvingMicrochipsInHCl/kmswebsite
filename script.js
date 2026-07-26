const canvas = document.getElementById('topoCanvas');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

const scale = 0.0020;
const gridSpacing = 20;
const numThresholds = 12;
let timeOffset = 0;

const Perlin = {
    p: new Uint8Array(256),
    init: function() {
        for (let i = 0; i < 256; i++) this.p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }
    },
    fade: t => t * t * t * (t * (t * 6 - 15) + 10),
    lerp: (t, a, b) => a + t * (b - a),
    grad: (hash, x, y, z) => {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    },
    noise: function(x, y, z) {
        const X = Math.floor(x) & 255,
              Y = Math.floor(y) & 255,
              Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        const u = this.fade(x),
              v = this.fade(y),
              w = this.fade(z);
        const A  = this.p[X] + Y,
              AA = this.p[A & 255] + Z,
              AB = this.p[(A + 1) & 255] + Z;
        const B  = this.p[X + 1] + Y,
              BA = this.p[B & 255] + Z,
              BB = this.p[(B + 1) & 255] + Z;

        return this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad(this.p[AA & 255], x, y, z),
                             this.grad(this.p[BA & 255], x - 1, y, z)),
                this.lerp(u, this.grad(this.p[AB & 255], x, y - 1, z),
                             this.grad(this.p[BB & 255], x - 1, y - 1, z))),
            this.lerp(v,
                this.lerp(u, this.grad(this.p[(AA + 1) & 255], x, y, z - 1),
                             this.grad(this.p[(BA + 1) & 255], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[(AB + 1) & 255], x, y - 1, z - 1),
                             this.grad(this.p[(BB + 1) & 255], x - 1, y - 1, z - 1)))
        );
    }
};
Perlin.init();

window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
});

const thresholds = Array.from({ length: numThresholds }, (_, i) =>
    0.1 + (i / (numThresholds - 1)) * 0.8
);

function getInterp(v1, v2, t) {
    if (Math.abs(v1 - v2) < 0.0001) return 0.5;
    return (t - v1) / (v2 - v1);
}

function animate() {
    ctx.fillStyle = '#050403ff';
    ctx.fillRect(0, 0, width, height);

    timeOffset += 0.0012;
    ctx.lineWidth = 1.0;

    // Размеры сетки в узлах
    const cols = Math.floor(width / gridSpacing) + 1;
    const rows = Math.floor(height / gridSpacing) + 1;

    // Предварительно вычисляем шум для всех узлов сетки
    const noiseValues = new Float32Array(rows * cols);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            noiseValues[y * cols + x] =
                (Perlin.noise(x * gridSpacing * scale, y * gridSpacing * scale, timeOffset) + 1) / 2;
        }
    }

    const n = (ix, iy) => noiseValues[iy * cols + ix];

    for (let tIdx = 0; tIdx < thresholds.length; tIdx++) {
        const t = thresholds[tIdx];
        const brightness = Math.floor(t * 220);
        const alpha = 0.15 + t * 0.45;
        ctx.strokeStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${alpha})`;
        ctx.filter = 'blur(1px)';

        ctx.beginPath();

        for (let yi = 0; yi < rows - 1; yi++) {
            for (let xi = 0; xi < cols - 1; xi++) {
                const n00 = n(xi, yi);
                const n10 = n(xi + 1, yi);
                const n01 = n(xi, yi + 1);
                const n11 = n(xi + 1, yi + 1);

                let cellCode = 0;
                if (n00 >= t) cellCode |= 8;
                if (n10 >= t) cellCode |= 4;
                if (n11 >= t) cellCode |= 2;
                if (n01 >= t) cellCode |= 1;

                if (cellCode === 0 || cellCode === 15) continue;

                const x = xi * gridSpacing;
                const y = yi * gridSpacing;

                const top =    { x: x + gridSpacing * getInterp(n00, n10, t), y: y };
                const right =  { x: x + gridSpacing, y: y + gridSpacing * getInterp(n10, n11, t) };
                const bottom = { x: x + gridSpacing * getInterp(n01, n11, t), y: y + gridSpacing };
                const left =   { x: x, y: y + gridSpacing * getInterp(n00, n01, t) };

                switch (cellCode) {
                    case 1: case 14: ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y); break;
                    case 2: case 13: ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(right.x, right.y); break;
                    case 3: case 12: ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); break;
                    case 4: case 11: ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y); break;
                    case 5:
                        ctx.moveTo(left.x, left.y); ctx.lineTo(top.x, top.y);
                        ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(right.x, right.y);
                        break;
                    case 6: case 9:  ctx.moveTo(top.x, top.y); ctx.lineTo(bottom.x, bottom.y); break;
                    case 7: case 8:  ctx.moveTo(left.x, left.y); ctx.lineTo(top.x, top.y); break;
                    case 10:
                        ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y);
                        ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
                        break;
                }
            }
        }

        ctx.stroke();
        ctx.filter = 'none';
    }

    requestAnimationFrame(animate);
}

animate();
