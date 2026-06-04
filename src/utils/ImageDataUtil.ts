import {ImageData} from '../store/labels/types';
import { v4 as uuidv4 } from 'uuid';
import {FileUtil} from './FileUtil';
import {ImageRepository} from '../logic/imageRepository/ImageRepository';
import { ImageGroupUtil } from './ImageGroupUtil';
import {
    LocalFileSystemDirectoryHandle,
    LocalFileSystemFileHandle,
} from '../interfaces/IFileSystemAccess';

export class ImageDataUtil {
    public static createImageDataFromFileData(
        fileData: File,
        groupName?: string,
        fileHandle?: LocalFileSystemFileHandle,
        directoryHandle?: LocalFileSystemDirectoryHandle,
        directoryId?: string
    ): ImageData {
        return {
            id: uuidv4(),
            fileData,
            fileHandle,
            directoryHandle,
            directoryId,
            groupName: ImageGroupUtil.normalizeGroupName(groupName),
            loadStatus: false,
            labelRects: [],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
            labelNameIds: [],
            isVisitedByYOLOObjectDetector: false,
            isVisitedBySSDObjectDetector: false,
            isVisitedByPoseDetector: false,
            isVisitedByRoboflowAPI: false
        }
    }

    public static cloneImageData(imageData: ImageData): ImageData {
        if (!imageData) {
            return imageData;
        }

        return {
            ...imageData,
            labelRects: imageData.labelRects.map((labelRect) => ({
                ...labelRect,
                rect: { ...labelRect.rect },
            })),
            labelPoints: imageData.labelPoints.map((labelPoint) => ({
                ...labelPoint,
                point: { ...labelPoint.point },
            })),
            labelLines: imageData.labelLines.map((labelLine) => ({
                ...labelLine,
                line: {
                    start: { ...labelLine.line.start },
                    end: { ...labelLine.line.end },
                },
            })),
            labelPolygons: imageData.labelPolygons.map((labelPolygon) => ({
                ...labelPolygon,
                vertices: labelPolygon.vertices.map((vertex) => ({ ...vertex })),
            })),
            labelNameIds: [...imageData.labelNameIds],
        };
    }

    public static cloneImagesData(imagesData: ImageData[]): ImageData[] {
        return imagesData.map((imageData: ImageData) => ImageDataUtil.cloneImageData(imageData));
    }

    public static cleanAnnotations(item: ImageData): ImageData {
        return {
            ...item,
            labelRects: [],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
            labelNameIds: []
        }
    }

    public static arrange(items: ImageData[], idArrangement: string[]): ImageData[] {
        return items.sort((a: ImageData, b: ImageData) => {
            return idArrangement.indexOf(a.id) - idArrangement.indexOf(b.id)
        })
    }

    public static loadMissingImages(images: ImageData[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const missingImages = images.filter((i: ImageData) => !i.loadStatus);
            const missingImagesFiles = missingImages.map((i: ImageData) => i.fileData);
            FileUtil.loadImages(missingImagesFiles)
                .then((htmlImageElements:HTMLImageElement[]) => {
                    ImageRepository.storeImages(missingImages.map((i: ImageData) => i.id), htmlImageElements);
                    resolve()
                })
                .catch((error: Error) => reject(error));
        });
    }
}
