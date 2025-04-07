export class AssetLoader {
    constructor() {
        this.images = {};
        this.totalImages = 0;
        this.loadedImages = 0;
        this.loadingComplete = false;
    }

    loadImage(name, src) {
        this.totalImages++;
        const img = new Image();
        img.onload = () => {
            this.loadedImages++;
            if (this.loadedImages === this.totalImages) {
                this.loadingComplete = true;
            }
        };
        img.src = src;
        this.images[name] = img;
    }

    getImage(name) {
        return this.images[name];
    }

    isReady() {
        return this.loadingComplete;
    }
} 