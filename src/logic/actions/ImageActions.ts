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
import { updateClassSanityCheckViolationImageIds } from "../../store/general/actionCreators";
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
import { ImageSortMode } from "../../data/enums/ImageSortMode";
import { ImageClassCriteria } from "../../store/general/types";
import { FileSystemAccessUtil } from "../../utils/FileSystemAccessUtil";
import { ImageDataUtil } from "../../utils/ImageDataUtil";
import { ClassSanityCheckUtil } from "../../utils/ClassSanityCheckUtil";
import { FileUtil } from "../../utils/FileUtil";
import { LocalFileSelection } from "../../interfaces/IFileSystemAccess";
import { ImageRepository } from "../imageRepository/ImageRepository";
import {
  LocalImageDirectoryData,
  LocalImageDirectoryRegistry,
} from "../imageRepository/LocalImageDirectoryRegistry";

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

  // Bumped on every navigateToIndex call; a call whose id no longer matches after an await was
  // superseded by a later navigation (e.g. reversing direction) and must not commit its result.
  private static navigationRequestId: number = 0;
  private static navigationSteps: Array<() => number | null> = [];
  private static isProcessingNavigationSteps: boolean = false;

  private static getFilteredImageIndices(): number[] {
    const imagesData = LabelsSelector.getImagesData();
    const activeLabelType = LabelsSelector.getActiveLabelType();
    const filterMode: ImageFilterMode = GeneralSelector.getImageListFilterMode();
    const searchText: string = GeneralSelector.getImageListSearchText();
    const imageClassCriteria: ImageClassCriteria[] = GeneralSelector.getImageClassCriteria();
    const keepLabeledInUnlabeled: boolean = GeneralSelector.getKeepLabeledInUnlabeled();
    const keptUnlabeledImageIds: string[] = GeneralSelector.getKeptUnlabeledImageIds();
    const sortMode: ImageSortMode = GeneralSelector.getImageListSortMode();
    const lockedImageSortOrderIds: string[] = GeneralSelector.getImageListSortOrderLocked()
      ? GeneralSelector.getLockedImageSortOrderIds()
      : [];
    return ImageFilterUtil.getFilteredImageIndices(
      imagesData,
      activeLabelType,
      filterMode,
      searchText,
      imageClassCriteria,
      keepLabeledInUnlabeled,
      keptUnlabeledImageIds,
      sortMode,
      lockedImageSortOrderIds
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

    const nextImagePosition = ImageFilterUtil.findNextOrderedPosition(
      LabelsSelector.getImagesData(),
      filteredIndices,
      currentImageIndex,
      GeneralSelector.getImageListSortMode(),
      GeneralSelector.getImageListSortOrderLocked()
        ? GeneralSelector.getLockedImageSortOrderIds()
        : []
    );

    if (nextImagePosition !== -1) {
      ImageActions.getImageByIndex(filteredIndices[nextImagePosition]);
      return;
    }

    ImageActions.getImageByIndex(filteredIndices[filteredIndices.length - 1]);
  }

  public static getPreviousImage(): void {
    ImageActions.enqueueNavigationStep(() => ImageActions.resolvePreviousIndex());
  }

  public static getNextImage(): void {
    ImageActions.enqueueNavigationStep(() => ImageActions.resolveNextIndex());
  }

  // Clears any steps still waiting in the queue - used to make releasing a held navigation key
  // stop immediately instead of draining the whole backlog queued up during the hold.
  public static cancelPendingNavigation(): void {
    ImageActions.navigationSteps = [];
  }

  private static resolvePreviousIndex(): number | null {
    const filteredIndices = ImageActions.getFilteredImageIndices();
    if (!filteredIndices.length) {
      return null;
    }

    const currentImageIndex: number | null = LabelsSelector.getActiveImageIndex();
    if (currentImageIndex === null || currentImageIndex === undefined) {
      return filteredIndices[filteredIndices.length - 1];
    }

    const currentFilteredIndex = filteredIndices.indexOf(currentImageIndex);
    if (currentFilteredIndex === -1) {
      return filteredIndices[filteredIndices.length - 1];
    }
    if (currentFilteredIndex === 0) {
      return null;
    }
    return filteredIndices[currentFilteredIndex - 1];
  }

  private static resolveNextIndex(): number | null {
    const filteredIndices = ImageActions.getFilteredImageIndices();
    if (!filteredIndices.length) {
      return null;
    }

    const currentImageIndex: number | null = LabelsSelector.getActiveImageIndex();
    if (currentImageIndex === null || currentImageIndex === undefined) {
      return filteredIndices[0];
    }

    const currentFilteredIndex = filteredIndices.indexOf(currentImageIndex);
    if (currentFilteredIndex === -1) {
      return filteredIndices[0];
    }
    if (currentFilteredIndex === filteredIndices.length - 1) {
      return null;
    }
    return filteredIndices[currentFilteredIndex + 1];
  }

  // Steps are resolved lazily (only once they're actually processed) so each one reads the
  // index the previous step just committed, rather than a stale snapshot taken at enqueue time.
  private static enqueueNavigationStep(resolveStep: () => number | null): void {
    if (EditorModel.viewPortActionsDisabled) {
      return;
    }
    ImageActions.navigationSteps.push(resolveStep);
    void ImageActions.processNavigationSteps();
  }

  private static async processNavigationSteps(): Promise<void> {
    if (ImageActions.isProcessingNavigationSteps) {
      return;
    }
    ImageActions.isProcessingNavigationSteps = true;
    try {
      while (ImageActions.navigationSteps.length > 0) {
        const resolveStep = ImageActions.navigationSteps.shift();
        const targetIndex = resolveStep();
        if (targetIndex !== null) {
          await ImageActions.navigateToIndex(targetIndex);
          // Without this, a burst of key-repeat events resolving in the same JS turn would
          // never actually get painted - only the last one would ever show up on screen.
          await ImageActions.waitForNextPaint();
        }
      }
    } finally {
      ImageActions.isProcessingNavigationSteps = false;
    }
  }

  private static waitForNextPaint(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private static updateClassSanityCheckForImageIndex(index: number | null): string[] {
    const settings = GeneralSelector.getClassSanityCheckSettings();
    const currentViolationImageIds = GeneralSelector.getClassSanityCheckViolationImageIds();
    const shouldValidate = settings.enabled;

    if (!shouldValidate || index === null || index === undefined) {
      return currentViolationImageIds;
    }

    const imageData = LabelsSelector.getImageDataByIndex(index);
    if (!imageData) {
      return currentViolationImageIds;
    }

    const violation = ClassSanityCheckUtil.getImageViolation(
      imageData,
      LabelsSelector.getLabelNames(),
      settings
    );
    const nextViolationImageIds = ClassSanityCheckUtil.upsertViolationImageId(
      currentViolationImageIds,
      imageData.id,
      !!violation
    );

    if (
      nextViolationImageIds.length !== currentViolationImageIds.length ||
      nextViolationImageIds.some((id, idIndex) => id !== currentViolationImageIds[idIndex])
    ) {
      store.dispatch(updateClassSanityCheckViolationImageIds(nextViolationImageIds));
    }

    return nextViolationImageIds;
  }

  private static activateImageByIndex(index: number): void {
    if (GeneralSelector.getFixedZoom()) {
      ViewPortActions.setZoom(1);
    }
    store.dispatch(updateActiveImageIndex(index));
    store.dispatch(updateActiveLabelId(null));
  }

  // Routed through the navigation queue (not a direct navigateToIndex call) so that a
  // getNextImage/getPreviousImage triggered right after this jump waits for the jump's async
  // updateActiveImageIndex dispatch to actually commit before reading the current index.
  public static getImageByIndex(index: number): void {
    ImageActions.enqueueNavigationStep(() => index);
  }

  // The active image index (and therefore the annotations, which are read live off it) only
  // advances once the target image is actually decoded and stored - instant if it's cached,
  // awaited otherwise. This is what guarantees the displayed image and its annotations can never
  // drift apart. A navigationRequestId token discards any decode superseded by a later navigation
  // (e.g. reversing direction) so a slow, now-irrelevant decode can't clobber a newer one.
  public static async navigateToIndex(index: number): Promise<void> {
    if (EditorModel.viewPortActionsDisabled) return;

    const imagesData = LabelsSelector.getImagesData();
    if (index < 0 || index > imagesData.length - 1) {
      return;
    }

    const activeImageIndex = LabelsSelector.getActiveImageIndex();
    if (activeImageIndex !== index) {
      ImageActions.updateClassSanityCheckForImageIndex(activeImageIndex);
    }

    const targetImageData = imagesData[index];
    const requestId = ++ImageActions.navigationRequestId;

    if (!ImageActions.isImageReady(targetImageData)) {
      try {
        const image = await ImageRepository.loadAndStore(targetImageData.id, targetImageData.fileData);
        if (requestId !== ImageActions.navigationRequestId) {
          return;
        }
        if (image && !targetImageData.loadStatus) {
          store.dispatch(updateImageDataById(targetImageData.id, {
            ...targetImageData,
            loadStatus: true,
          }));
        }
      } catch (error) {
        console.warn('Could not load image for navigation:', error);
        return;
      }
    }

    if (requestId !== ImageActions.navigationRequestId) {
      return;
    }

    ImageActions.activateImageByIndex(index);
  }

  private static isImageReady(imageData: ImageData): boolean {
    return imageData.loadStatus && !!ImageRepository.getById(imageData.id);
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
    return ImageActions.getRefreshDirectories(imagesData).length > 0
      || ImageActions.getRefreshableStandaloneImages(imagesData).length > 0;
  }

  public static async refreshLocalImageFolders(): Promise<void> {
    if (ImageActions.isRefreshingLocalImageFolders) {
      return;
    }

    ImageActions.isRefreshingLocalImageFolders = true;

    try {
      const imagesData = LabelsSelector.getImagesData();
      const directories = ImageActions.getRefreshDirectories(imagesData);
      const standaloneImagesData = ImageActions.getRefreshableStandaloneImages(imagesData);

      await ImageActions.mapWithConcurrency(
        directories,
        Math.min(LOCAL_FOLDER_REFRESH_CONCURRENCY, directories.length || 1),
        async (directory: LocalImageDirectoryData) => {
          try {
            const selections = await FileSystemAccessUtil.scanImageFilesFromDirectoryHandle(
              directory.directoryHandle
            );
            await ImageActions.refreshLocalImageFolder(directory, imagesData, selections);
          } catch (error) {
            console.warn('Could not refresh local image folder:', error);
          }
        }
      );

      await ImageActions.mapWithConcurrency(
        standaloneImagesData,
        LOCAL_FOLDER_REFRESH_CONCURRENCY,
        ImageActions.refreshStandaloneLocalImage
      );
    } finally {
      ImageActions.isRefreshingLocalImageFolders = false;
    }
  }

  private static async refreshStandaloneLocalImage(imageData: ImageData): Promise<void> {
    try {
      const file = await imageData.fileHandle.getFile();
      if (ImageActions.hasLocalFileChanged(imageData.fileData, file)) {
        await ImageActions.refreshModifiedLocalImage(imageData, {
          file,
          fileHandle: imageData.fileHandle,
        });
      }
    } catch (error) {
      const fileExists = await FileSystemAccessUtil.localImageFileExists(imageData);
      if (fileExists === false) {
        ImageActions.removeImageFromProject(imageData);
        return;
      }

      console.warn('Could not refresh selected local image:', error);
    }
  }

  private static async refreshLocalImageFolder(
    directory: LocalImageDirectoryData,
    imagesData: ImageData[],
    selections: LocalFileSelection[]
  ): Promise<void> {
    const directoryImagesData = imagesData.filter((imageData: ImageData) =>
      imageData.directoryId === directory.id
    );
    const directorySelections = selections.filter((selection: LocalFileSelection) =>
      selection.directoryHandle === directory.directoryHandle
    );
    const currentDirectoryImageFileNames = FileSystemAccessUtil
      .getDirectoryImageFileNamesFromSelections(directorySelections);
    const knownDirectoryImageFileNames = new Set(directory.knownImageFileNames);
    const selectionIndexByName = ImageActions.getSelectionIndexByName(directorySelections);
    const refreshPlans = directoryImagesData.map((imageData: ImageData) =>
      ImageActions.getLocalImageFolderRefreshPlan(imageData, directorySelections, selectionIndexByName)
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
          refreshPlan.matchingSelection
        );
      }
    );

    const matchedSelectionIndexes = new Set(
      refreshPlans
        .map((refreshPlan: LocalImageFolderRefreshPlan) => refreshPlan.matchingSelectionIndex)
        .filter((matchingSelectionIndex: number) => matchingSelectionIndex !== -1)
    );
    const newSelections = directorySelections.filter((selection: LocalFileSelection, index: number) =>
      !matchedSelectionIndexes.has(index)
      && !knownDirectoryImageFileNames.has(selection.file.name)
    );

    if (newSelections.length > 0) {
      const groupName = ImageActions.getCommonGroupName(directoryImagesData);
      store.dispatch(addImageData(newSelections.map((selection: LocalFileSelection) =>
        ImageDataUtil.createImageDataFromFileData(
          selection.file,
          groupName,
          selection.fileHandle,
          selection.directoryHandle || directory.directoryHandle,
          directory.id
        )
      )));
    }

    LocalImageDirectoryRegistry.replaceKnownImageFileNames(
      directory.id,
      currentDirectoryImageFileNames
    );
  }

  private static getRefreshDirectories(imagesData: ImageData[]): LocalImageDirectoryData[] {
    const directoryIds = new Set<string>();
    const directories: LocalImageDirectoryData[] = [];

    imagesData.forEach((imageData: ImageData) => {
      if (!imageData.directoryId || directoryIds.has(imageData.directoryId)) {
        return;
      }

      const directory = LocalImageDirectoryRegistry.getById(imageData.directoryId);
      if (directory) {
        directoryIds.add(imageData.directoryId);
        directories.push(directory);
      }
    });

    return directories;
  }

  private static getRefreshableStandaloneImages(imagesData: ImageData[]): ImageData[] {
    return imagesData.filter((imageData: ImageData) =>
      !imageData.directoryId && !!imageData.fileHandle?.getFile
    );
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
    selection: LocalFileSelection
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
      directoryId: imageData.directoryId,
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
    LocalImageDirectoryRegistry.removeKnownImageFileName(imageData.directoryId, imageData.fileData.name);
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
