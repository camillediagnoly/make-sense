import {zip} from "lodash";
import {FileUtil} from "../../utils/FileUtil";

export type ImageMap = { [s: string]: HTMLImageElement; };

export class ImageRepository {
    private static repository: ImageMap = {};
    private static pendingLoads: { [s: string]: Promise<HTMLImageElement> } = {};

    public static storeImage(id: string, image: HTMLImageElement) {
        ImageRepository.repository[id] = image;
    }

    public static storeImages(ids: string[], images: HTMLImageElement[]) {
        zip(ids, images).forEach((pair: [string, HTMLImageElement]) => {
            ImageRepository.storeImage(...pair);
        })
    }

    public static getById(uuid: string): HTMLImageElement {
        return ImageRepository.repository[uuid];
    }

    public static deleteById(uuid: string): void {
        delete ImageRepository.repository[uuid];
    }

    // Joins an already in-flight decode for the same id instead of starting a duplicate one -
    // callers that need the same image at roughly the same time (e.g. the editor and a thumbnail) share one decode.
    public static loadAndStore(id: string, file: File): Promise<HTMLImageElement> {
        const cached = ImageRepository.getById(id);
        if (cached) {
            return Promise.resolve(cached);
        }

        const pending = ImageRepository.pendingLoads[id];
        if (pending) {
            return pending;
        }

        const loadPromise = FileUtil.loadImage(file)
            .then((image: HTMLImageElement) => {
                ImageRepository.storeImage(id, image);
                return image;
            })
            .finally(() => {
                delete ImageRepository.pendingLoads[id];
            });

        ImageRepository.pendingLoads[id] = loadPromise;
        return loadPromise;
    }
}