export class Renderer {
    constructor(canvas, ctx, config) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
    }

    render(simulation) {
        // Очистка
        this.ctx.fillStyle = '#091414';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Сохраняем контекст
        this.ctx.save();

        // Переходим в центр экрана и рисуем корабль
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);

        // Рисуем корабль как треугольник
        this.ctx.save();
        this.ctx.rotate(simulation.ship.angle);
        this.ctx.beginPath();
        this.ctx.moveTo(20, 0);
        this.ctx.lineTo(-10, 10);
        this.ctx.lineTo(-10, -10);
        this.ctx.closePath();
        this.ctx.fillStyle = 'white';
        this.ctx.fill();
        this.ctx.restore();

        this.ctx.restore();
    }

    onResize() {
        // При изменении размера окна
    }
}