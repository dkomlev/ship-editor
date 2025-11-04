export class Input {
    constructor(config) {
        this.config = config;
        this.keys = {};

        window.addEventListener('keydown', (e) => this.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);
    }

    getKey(key) {
        return this.keys[key] || false;
    }
}