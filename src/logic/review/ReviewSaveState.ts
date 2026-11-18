import { ImageData, LabelPolygon, LabelRect } from '../../store/labels/types';

type Listener = () => void;

// Whether the review has changes that were not saved yet. Only what is saved counts: the place,
// label and deletion of the rectangles and polygons, not their visibility nor the images seen.
export class ReviewSaveState {
    // Per image id, the annotations as they were last loaded or saved
    private static savedSignatures: Map<string, string> = new Map();
    private static lastSavedAt: Date | null = null;
    private static listeners: Set<Listener> = new Set();
    // The image data of the store are immutable: their signature is computed once
    private static signatureCache: WeakMap<ImageData, string> = new WeakMap();

    public static markLoaded(imagesData: ImageData[]): void {
        ReviewSaveState.remember(imagesData);
        ReviewSaveState.lastSavedAt = null;
        ReviewSaveState.notify();
    }

    public static markSaved(imagesData: ImageData[]): void {
        ReviewSaveState.remember(imagesData);
        ReviewSaveState.lastSavedAt = new Date();
        ReviewSaveState.notify();
    }

    public static clear(): void {
        ReviewSaveState.savedSignatures = new Map();
        ReviewSaveState.lastSavedAt = null;
        ReviewSaveState.notify();
    }

    public static getLastSavedAt(): Date | null {
        return ReviewSaveState.lastSavedAt;
    }

    public static hasUnsavedChanges(imagesData: ImageData[]): boolean {
        return imagesData.some((imageData: ImageData) =>
            ReviewSaveState.savedSignatures.get(imageData.id) !== ReviewSaveState.getSignature(imageData));
    }

    public static subscribe(listener: Listener): () => void {
        ReviewSaveState.listeners.add(listener);
        return () => ReviewSaveState.listeners.delete(listener);
    }

    private static remember(imagesData: ImageData[]): void {
        ReviewSaveState.savedSignatures = new Map(imagesData.map((imageData: ImageData) =>
            [imageData.id, ReviewSaveState.getSignature(imageData)]));
    }

    private static notify(): void {
        ReviewSaveState.listeners.forEach((listener: Listener) => listener());
    }

    private static getSignature(imageData: ImageData): string {
        const cached = ReviewSaveState.signatureCache.get(imageData);
        if (cached !== undefined) {
            return cached;
        }
        const signature = JSON.stringify([
            imageData.labelRects.map((labelRect: LabelRect) =>
                [labelRect.id, labelRect.labelId, !!labelRect.isDeleted, labelRect.rect]),
            imageData.labelPolygons.map((labelPolygon: LabelPolygon) =>
                [labelPolygon.id, labelPolygon.labelId, !!labelPolygon.isDeleted, labelPolygon.vertices]),
        ]);
        ReviewSaveState.signatureCache.set(imageData, signature);
        return signature;
    }
}
