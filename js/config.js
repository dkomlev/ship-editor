export class Config {
    constructor() {
        this.appConfig = null;
        this.shipConfig = null;
        this.loaded = this.load();
    }

    async load() {
        // Загружаем app.json
        const appResponse = await fetch('./config/app.json');
        this.appConfig = await appResponse.json();

        // Загружаем ship.json по пути из appConfig
        const shipPath = this.appConfig.paths.ship_config_path;
        const shipResponse = await fetch(shipPath);
        this.shipConfig = await shipResponse.json();
    }
}