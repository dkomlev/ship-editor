import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Config } from './config.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Загрузка конфигов
        this.config = new Config();

        // Инициализация симуляции, рендерера и ввода
        this.simulation = new Simulation(this.config);
        this.renderer = new Renderer(this.canvas, this.ctx, this.config);
        this.input = new Input(this.config);

        // Настройка размера canvas
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Запуск игрового цикла
        this.lastTime = 0;
        this.animate(0);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.renderer.onResize();
    }

    animate(time) {
        const deltaTime = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // Обновление симуляции
        this.simulation.update(deltaTime);

        // Отрисовка
        this.renderer.render(this.simulation);

        requestAnimationFrame((t) => this.animate(t));
    }
}

// Запуск игры после загрузки конфигов
window.addEventListener('load', () => {
    new Game();
});