import { LabelsSelector } from "../../store/selectors/LabelsSelector";
import { store } from "../../index";
import {
  updateActiveImageIndex,
  updateActiveLabelId,
  updateActiveLabelNameId,
  updateImageDataById,
  deleteImageDataById,
  addImageData,
} from "../../store/labels/actionCreators";
import { ViewPortActions } from "./ViewPortActions";
import { EditorModel } from "../../staticModels/EditorModel";
import { LabelType } from "../../data/enums/LabelType";
import {
  ImageData,
  LabelLine,
  LabelPoint,
  LabelPolygon,
  LabelRect,
} from "../../store/labels/types";
import { LabelStatus } from "../../data/enums/LabelStatus";
import { GeneralSelector } from "../../store/selectors/GeneralSelector";
import { ImageFilterUtil } from "../../utils/ImageFilterUtil";
import { ImageFilterMode } from "../../data/enums/ImageFilterMode";
import { ImageClassCriteria } from "../../store/general/types";
import { FileSystemAccessUtil } from "../../utils/FileSystemAccessUtil";
import { ImageDataUtil } from "../../utils/ImageDataUtil";
import { FileUtil } from "../../utils/FileUtil";
import {
  LocalFileSelection,
  LocalFileSystemDirectoryHandle,
} from "../../interfaces/IFileSystemAccess";
import { ImageRepository } from "../imageRepository/ImageRepository";

type ImageDimensions = {
  width: number;
  height: number;
};

type LocalImageFolderRefreshPlan = {
  imageData: ImageData;
  matchingSelection: LocalFileSelection | null;
  matchingSelectionIndex: number;
};

const LOCAL_FOLDER_REFRESH_CONCURRENCY = 4;

export class ImageActions {
  private static isSyncingDeletedLocalImages: boolean = false;
  private static isRefreshingLocalImageFolders: boolean = false;

  private static getFilteredImageIndices(): number[] {
    const imagesData = LabelsSelector.getImagesData();
    const activeLabelType = LabelsSelector.getActiveLabelType();
    const filterMode: ImageFilterMode = GeneralSelector.getImageListFilterMode();
    const searchText: string = GeneralSelector.getImageListSearchText();
    const imageClassCriteria: ImageClassCriteria[] = GeneralSelector.getImageClassCriteria();
    const keepLabeledInUnlabeled: boolean = GeneralSelector.getKeepLabeledInUnlabeled();
    const keptUnlabeledImageIds: string[] = GeneralSelector.getKeptUnlabeledImageIds();
    return ImageFilterUtil.getFilteredImageIndices(
      imagesData,
      activeLabelType,
      filterMode,
      searchText,
      imageClassCriteria,
      keepLabeledInUnlabeled,
      keptUnlabeledImageIds
    );
  }

  public static syncActiveImageWithFilters(): void {
    const filteredIndices = ImageActions.getFilteredImageIndices();
    if (!filteredIndices.length) {
      return;
    }

    const currentImageIndex: number | null = LabelsSelector.getActiveImageIndex();
    if (currentImageIndex === null || currentImageIndex === undefined) {
      ImageActions.getImageByIndex(filteredIndices[0]);
      return;
    }

    if (filteredIndices.includes(currentImageIndex)) {
      return;
    }

    const nextImageInOriginalOrder = filteredIndices.find(
      (index: number) => index > currentImageIndex
    );

    if (nextImageInOriginalOrder !== undefined) {
      ImageActions.getImageByIndex(nextImageInOriginalOrder);
      return;
    }

    ImageActions.getImageByIndex(filteredIndices[filteredIndices.length - 1]);
  }

  public static getPreviousImage(): void {
    const filteredIndices = ImageActions.getFilteredImageIndices();
    if (!filteredIndices.length) {
      return;
    }

    const currentImageIndex: number | null = LabelsSelector.getActiveImageIndex();
    if (currentImageIndex === null || currentImageIndex === undefined) {
      ImageActions.getImageByIndex(
        filteredIndices[filteredIndices.length - 1]
      );
      return;
    }

    const currentFilteredIndex = filteredIndices.indexOf(currentImageIndex);
    if (currentFilteredIndex === -1) {
      ImageActions.getImageByIndex(
        filteredIndices[filteredIndices.length - 1]
      );
      return;
    }
    if (currentFilteredIndex === 0) {
      return;
    }
    ImageActions.getImageByIndex(filteredIndices[currentFilteredIndex - 1]);
  }

  public static getNextImage(): void {
    const filteredIndices = ImageActions.getFilteredImageIndices();
    if (!filteredIndices.length) {
      return;
    }

    const currentImageIndex: number | null = LabelsSelector.getActiveImageIndex();
    if (currentImageIndex === null || currentImageIndex === undefined) {
      ImageActions.getImageByIndex(filteredIndices[0]);
      return;
    }

    const currentFilteredIndex = filteredIndices.indexOf(currentImageIndex);
    if (currentFilteredIndex === -1) {
      ImageActions.getImageByIndex(filteredIndices[0]);
      return;
    }
    if (currentFilteredIndex === filteredIndices.length - 1) {
      return;
    }
    ImageActions.getImageByIndex(filteredIndices[currentFilteredIndex + 1]);
  }

  public static getImageByIndex(index: number): void {
    if (EditorModel.viewPortActionsDisabled) return;

    const imageCount: number = LabelsSelector.getImagesData().length;

    if (index < 0 || index > imageCount - 1) {
      return;
    } else {
      if (GeneralSelector.getFixedZoom()) {
        ViewPortActions.setZoom(1);
      }
      store.dispatch(updateActiveImageIndex(index));
      store.dispatch(updateActiveLabelId(null));
    }
  }

  public static async deleteImage(imageData: ImageData): Promise<void> {
    if (!imageData) {
      return;
    }

    if (!FileSystemAccessUtil.canDeleteLocalFile(imageData)) {
      console.warn(
        'Local deletion is only available for images opened with Chrome file access.'
      );
      return;
    }

    try {
      await FileSystemAccessUtil.deleteLocalImageFile(imageData);
      ImageActions.removeImageFromProject(imageData);
    } catch (error) {
      const fileExists = await FileSystemAccessUtil.localImageFileExists(imageData);
      if (fileExists === false) {
        ImageActions.removeImageFromProject(imageData);
        return;
      }

      console.error('Failed to delete local image file:', error);
    }
  }

  public static async syncDeletedLocalImages(): Promise<void> {
    if (ImageActions.isSyncingDeletedLocalImages
      || !FileSystemAccessUtil.supportsLocalFileDeletion()) {
      return;
    }

    ImageActions.isSyncingDeletedLocalImages = true;

    try {
      const imagesData = LabelsSelector.getImagesData();
      for (const imageData of imagesData) {
        const fileExists = await FileSystemAccessUtil.localImageFileExists(imageData);
        if (fileExists === false) {
          ImageActions.removeImageFromProject(imageData);
        }
      }
    } finally {
      ImageActions.isSyncingDeletedLocalImages = false;
    }
  }

  public static canRefreshLocalImageFolders(
    imagesData: ImageData[] = LabelsSelector.getImagesData()
  ): boolean {
    return FileSystemAccessUtil.supportsLocalFileDeletion()
      && ImageActions.getRefreshDirectoryHandles(imagesData).length > 0;
  }

  public static async refreshLocalImageFolders(): Promise<void> {
    if (ImageActions.isRefreshingLocalImageFolders
      || !FileSystemAccessUtil.supportsLocalFileDeletion()) {
      return;
    }

    ImageActions.isRefreshingLocalImageFolders = true;

    try {
      const imagesData = LabelsSelector.getImagesData();
      const directoryHandles = ImageActions.getRefreshDirectoryHandles(imagesData);

      await ImageActions.mapWithConcurrency(
        directoryHandles,
        Math.min(LOCAL_FOLDER_REFRESH_CONCURRENCY, directoryHandles.length || 1),
        async (directoryHandle: LocalFileSystemDirectoryHandle) => {
          try {
            const selections = await FileSystemAccessUtil.getImageFilesFromDirectoryHandle(directoryHandle);
            await ImageActions.refreshLocalImageFolder(directoryHandle, imagesData, selections);
          } catch (error) {
            console.warn('Could not refresh local image folder:', error);
          }
        }
      );
    } finally {
      ImageActions.isRefreshingLocalImageFolders = false;
    }
  }

  private static async refreshLocalImageFolder(
    directoryHandle: LocalFileSystemDirectoryHandle,
    imagesData: ImageData[],
    selections: LocalFileSelection[]
  ): Promise<void> {
    const directoryImagesData = imagesData.filter((imageData: ImageData) =>
      imageData.directoryHandle === directoryHandle
    );
    const directoryImageFileNames = FileSystemAccessUtil
      .getDirectoryImageFileNamesFromSelections(selections);
    const selectionIndexByName = ImageActions.getSelectionIndexByName(selections);
    const refreshPlans = directoryImagesData.map((imageData: ImageData) =>
      ImageActions.getLocalImageFolderRefreshPlan(imageData, selections, selectionIndexByName)
    );

    refreshPlans.forEach((refreshPlan: LocalImageFolderRefreshPlan) => {
      if (!refreshPlan.matchingSelection) {
        ImageActions.removeImageFromProject(refreshPlan.imageData);
      }
    });

    const modifiedRefreshPlans = refreshPlans.filter((refreshPlan: LocalImageFolderRefreshPlan) => {
      const matchingSelection = refreshPlan.matchingSelection;
      return !!matchingSelection
        && ImageActions.hasLocalFileChanged(refreshPlan.imageData.fileData, matchingSelection.file);
    });

    await ImageActions.mapWithConcurrency(
      modifiedRefreshPlans,
      LOCAL_FOLDER_REFRESH_CONCURRENCY,
      async (refreshPlan: LocalImageFolderRefreshPlan) => {
        await ImageActions.refreshModifiedLocalImage(
          refreshPlan.imageData,
          refreshPlan.matchingSelection,
          directoryImageFileNames
        );
      }
    );

    const matchedSelectionIndexes = new Set(
      refreshPlans
        .map((refreshPlan: LocalImageFolderRefreshPlan) => refreshPlan.matchingSelectionIndex)
        .filter((matchingSelectionIndex: number) => matchingSelectionIndex !== -1)
    );
    const knownDirectoryFileNames = ImageActions.getKnownDirectoryFileNames(directoryImagesData);
    const newSelections = selections.filter((selection: LocalFileSelection, index: number) =>
      !matchedSelectionIndexes.has(index)
      && !knownDirectoryFileNames.has(selection.file.name)
    );

    if (newSelections.length > 0) {
      const groupName = ImageActions.getCommonGroupName(directoryImagesData);
      store.dispatch(addImageData(newSelections.map((selection: LocalFileSelection) =>
        ImageDataUtil.createImageDataFromFileData(
          selection.file,
          groupName,
          selection.fileHandle,
          selection.directoryHandle || directoryHandle,
          directoryImageFileNames
        )
      )));
    }
  }

  private static getRefreshDirectoryHandles(imagesData: ImageData[]): LocalFileSystemDirectoryHandle[] {
    const directoryHandles: LocalFileSystemDirectoryHandle[] = [];

    imagesData.forEach((imageData: ImageData) => {
      const directoryHandle = imageData.directoryHandle;
      if (directoryHandle?.values && !directoryHandles.includes(directoryHandle)) {
        directoryHandles.push(directoryHandle);
      }
    });

    return directoryHandles;
  }

  private static getLocalImageFolderRefreshPlan(
    imageData: ImageData,
    selections: LocalFileSelection[],
    selectionIndexByName: Map<string, number>
  ): LocalImageFolderRefreshPlan {
    const matchingSelectionIndex = selectionIndexByName.has(imageData.fileData.name)
      ? selectionIndexByName.get(imageData.fileData.name)
      : -1;

    return {
      imageData,
      matchingSelection: matchingSelectionIndex === -1 ? null : selections[matchingSelectionIndex],
      matchingSelectionIndex,
    };
  }

  private static getSelectionIndexByName(selections: LocalFileSelection[]): Map<string, number> {
    const selectionIndexByName = new Map<string, number>();

    selections.forEach((selection: LocalFileSelection, index: number) => {
      if (!selectionIndexByName.has(selection.file.name)) {
        selectionIndexByName.set(selection.file.name, index);
      }
    });

    return selectionIndexByName;
  }

  private static hasLocalFileChanged(previousFile: File, nextFile: File): boolean {
    return previousFile.size !== nextFile.size
      || previousFile.lastModified !== nextFile.lastModified;
  }

  private static async refreshModifiedLocalImage(
    imageData: ImageData,
    selection: LocalFileSelection,
    directoryImageFileNames: string[]
  ): Promise<void> {
    const previousDimensions = await ImageActions.getImageDataDimensions(imageData);
    const nextImage = await ImageActions.loadImage(selection.file);

    if (!nextImage) {
      return;
    }

    if (previousDimensions
      && (previousDimensions.width !== nextImage.width
        || previousDimensions.height !== nextImage.height)) {
      console.warn(
        `Skipped refreshing ${selection.file.name} because its dimensions changed.`
      );
      return;
    }

    ImageRepository.storeImage(imageData.id, nextImage);
    store.dispatch(updateImageDataById(imageData.id, {
      ...imageData,
      fileData: selection.file,
      fileHandle: selection.fileHandle || imageData.fileHandle,
      directoryHandle: selection.directoryHandle || imageData.directoryHandle,
      directoryImageFileNames: imageData.directoryImageFileNames || directoryImageFileNames,
      loadStatus: true,
      imgWidth: nextImage.width,
      imgHeight: nextImage.height,
    }));
  }

  private static async getImageDataDimensions(imageData: ImageData): Promise<ImageDimensions | null> {
    const image = ImageRepository.getById(imageData.id);
    if (image) {
      return { width: image.width, height: image.height };
    }

    if (imageData.imgWidth && imageData.imgHeight) {
      return { width: imageData.imgWidth, height: imageData.imgHeight };
    }

    const loadedImage = await ImageActions.loadImage(imageData.fileData);
    return loadedImage
      ? { width: loadedImage.width, height: loadedImage.height }
      : null;
  }

  private static async loadImage(file: File): Promise<HTMLImageElement | null> {
    try {
      return await FileUtil.loadImage(file);
    } catch (error) {
      console.warn('Could not load local image file:', error);
      return null;
    }
  }

  private static getKnownDirectoryFileNames(imagesData: ImageData[]): Set<string> {
    const fileNames = new Set<string>();

    imagesData.forEach((imageData: ImageData) => {
      const directoryImageFileNames = imageData.directoryImageFileNames;
      if (directoryImageFileNames?.length) {
        directoryImageFileNames.forEach((fileName: string) => fileNames.add(fileName));
      } else {
        fileNames.add(imageData.fileData.name);
      }
    });

    return fileNames;
  }

  private static getCommonGroupName(imagesData: ImageData[]): string | undefined {
    if (!imagesData.length) {
      return undefined;
    }

    const groupNames = new Set(imagesData.map((imageData: ImageData) => imageData.groupName || ''));
    return groupNames.size === 1 ? imagesData[0].groupName : undefined;
  }

  private static async mapWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    let nextIndex = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);

    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex]);
      }
    }));
  }

  private static removeImageFromProject(imageData: ImageData): void {
    ImageRepository.deleteById(imageData.id);
    store.dispatch(deleteImageDataById(imageData.id));
  }

  public static setActiveLabelOnActiveImage(labelIndex: number): void {
    const labelNames = LabelsSelector.getLabelNames();
    if (labelNames.length < labelIndex + 1) {
      return;
    }

    const imageData: ImageData = LabelsSelector.getActiveImageData();
    store.dispatch(
      updateImageDataById(
        imageData.id,
        ImageActions.mapNewImageData(imageData, labelIndex)
      )
    );
    store.dispatch(updateActiveLabelNameId(labelNames[1].id));
  }

  private static mapNewImageData(
    imageData: ImageData,
    labelIndex: number
  ): ImageData {
    const labelType: LabelType = LabelsSelector.getActiveLabelType();
    const labelNames = LabelsSelector.getLabelNames();
    let newImageData: ImageData = {
      ...imageData,
    };
    switch (labelType) {
      case LabelType.POINT:
        const point = LabelsSelector.getActivePointLabel();
        newImageData.labelPoints = imageData.labelPoints.map(
          (labelPoint: LabelPoint) => {
            if (labelPoint.id === point.id) {
              return {
                ...labelPoint,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelPoint;
          }
        );
        store.dispatch(updateActiveLabelId(point.id));
        break;
      case LabelType.LINE:
        const line = LabelsSelector.getActiveLineLabel();
        newImageData.labelLines = imageData.labelLines.map(
          (labelLine: LabelLine) => {
            if (labelLine.id === line.id) {
              return {
                ...labelLine,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelLine;
          }
        );
        store.dispatch(updateActiveLabelId(line.id));
        break;
      case LabelType.RECT:
        const rect = LabelsSelector.getActiveRectLabel();
        newImageData.labelRects = imageData.labelRects.map(
          (labelRectangle: LabelRect) => {
            if (labelRectangle.id === rect.id) {
              return {
                ...labelRectangle,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelRectangle;
          }
        );
        store.dispatch(updateActiveLabelId(rect.id));
        break;
      case LabelType.POLYGON:
        const polygon = LabelsSelector.getActivePolygonLabel();
        newImageData.labelPolygons = imageData.labelPolygons.map(
          (labelPolygon: LabelPolygon) => {
            if (labelPolygon.id === polygon.id) {
              return {
                ...labelPolygon,
                labelId: labelNames[labelIndex].id,
                status: LabelStatus.ACCEPTED,
              };
            }
            return labelPolygon;
          }
        );
        store.dispatch(updateActiveLabelId(polygon.id));
        break;
      case LabelType.IMAGE_RECOGNITION:
        const labelId: string = labelNames[labelIndex].id;
        if (imageData.labelNameIds.includes(labelId)) {
          newImageData.labelNameIds = imageData.labelNameIds.filter(
            (element: string) => element !== labelId
          );
        } else {
          newImageData.labelNameIds = imageData.labelNameIds.concat(labelId);
        }
        break;
    }

    return newImageData;
  }
}
