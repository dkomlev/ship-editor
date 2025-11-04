export class Simulation {
    constructor(config) {
        this.config = config;
        this.ship = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            angle: 0, // в радианах
            angularVelocity: 0
        };
    }

    update(deltaTime) {
        // Пока просто движемся вперед по углу (для теста)
        const thrust = 100; // временная константа
        this.ship.vx += Math.cos(this.ship.angle) * thrust * deltaTime;
        this.ship.vy += Math.sin(this.ship.angle) * thrust * deltaTime;

        this.ship.x += this.ship.vx * deltaTime;
        this.ship.y += this.ship.vy * deltaTime;

        // Применяем тор (wrap-around)
        const bounds = this.config.world.bounds_rect_m;
        if (this.ship.x > bounds.w / 2) this.ship.x = -bounds.w / 2;
        if (this.ship.x < -bounds.w / 2) this.ship.x = bounds.w / 2;
        if (this.ship.y > bounds.h / 2) this.ship.y = -bounds.h / 2;
        if (this.ship.y < -bounds.h / 2) this.ship.y = bounds.h / 2;
    }
}