import {ImageData, LabelName, LabelRect, TagConfig, TagName} from '../../../store/labels/types';
import {LabelUtil} from "../../../utils/LabelUtil";
import {AnnotationImporter} from '../AnnotationImporter';
import {LabelsSelector} from '../../../store/selectors/LabelsSelector';
import { FileUtil } from '../../../utils/FileUtil';
import { TagUtil } from '../../../utils/TagUtil';
import { ArrayUtil } from '../../../utils/ArrayUtil';
import { Settings } from '../../../settings/Settings';
import { MeasurementFunctionByName } from '../../../data/measurements/MeasurementFunctionData';

// A tag read from the <tags> element of a file, with its group when the file gives one
type ParsedTag = {
    name: string,
    groupName?: string
};

type FileParseResult = {
    filename: string,
    labeledBoxes: LabelRect[],
    tags: ParsedTag[]
};

type VOCImportResult = {
    labelNames: Record<string, LabelName>,
    fileParseResults: FileParseResult[],
    failedFiles: string[],
};

export class DocumentParsingError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "DocumentParsingError";
    }
}

export class AnnotationAssertionError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "AnnotationAssertionError";
    }
}

export class PartialVOCImportError extends Error {
    public readonly fileNames: string[];
    public readonly imagesData: ImageData[];
    public readonly labelNames: LabelName[];
    public readonly tagConfig: TagConfig;

    constructor(fileNames: string[], imagesData: ImageData[], labelNames: LabelName[], tagConfig: TagConfig) {
        super('Some annotation files could not be imported.');
        this.name = "PartialVOCImportError";
        this.fileNames = fileNames;
        this.imagesData = imagesData;
        this.labelNames = labelNames;
        this.tagConfig = tagConfig;
    }
}

const parser = new DOMParser();

export class VOCImporter extends AnnotationImporter {
    private static readonly READ_BATCH_SIZE = 100;

    public import(
        filesData: File[],
        onSuccess: (
            imagesData: ImageData[],
            labelNames: LabelName[],
            measurementFunctionByName?: MeasurementFunctionByName,
            tagConfig?: TagConfig,
        ) => any,
        onFailure: (error?:Error) => any
    ): void {
        try {
            const inputImagesData: Record<string, ImageData> = VOCImporter.mapImageData();

            this.loadAndParseFiles(filesData).then(results => {
                // Each file is the reference for its image, for the boxes as for the tags
                for (const result of results.fileParseResults) {
                    if (inputImagesData[result.filename]) {
                        inputImagesData[result.filename].labelRects = result.labeledBoxes;
                        inputImagesData[result.filename].tags = result.tags.map((tag: ParsedTag) => tag.name);
                    }
                }

                const imagesData = Array.from(Object.values(inputImagesData));
                const labelNames = Array.from(Object.values(results.labelNames));
                // The files only describe the tags their image carries, so the project tags are
                // kept and the new ones are added to them.
                const tagConfig: TagConfig = TagUtil.mergeTagConfigs(
                    LabelsSelector.getTagConfig(),
                    VOCImporter.mapTagConfig(results.fileParseResults)
                );

                if (results.failedFiles.length !== 0) {
                    onFailure(new PartialVOCImportError(results.failedFiles, imagesData, labelNames, tagConfig));
                    return;
                }

                onSuccess(imagesData, labelNames, {}, tagConfig);
            }).catch((error: Error) => onFailure(error));
        } catch (error) {
            onFailure(error as Error)
        }
    }

    private async loadAndParseFiles(files: File[]): Promise<VOCImportResult> {
        const result: VOCImportResult = {
            labelNames: {},
            fileParseResults: [],
            failedFiles: [],
        };

        for (let index = 0; index < files.length; index += VOCImporter.READ_BATCH_SIZE) {
            const batch = files.slice(index, index + VOCImporter.READ_BATCH_SIZE);
            const fileTexts = await Promise.all(batch.map((file: File) =>
                FileUtil.readFile(file)
                    .then((value: string) => ({ fileName: file.name, value }))
                    .catch(() => ({ fileName: file.name, value: null }))
            ));

            for (const fileText of fileTexts) {
                if (!fileText.value) {
                    result.failedFiles.push(fileText.fileName);
                    continue;
                }

                try {
                    VOCImporter.parseDocumentIntoImageData(VOCImporter.tryParseVOCDocument(fileText.value), result);
                } catch {
                    result.failedFiles.push(fileText.fileName);
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        return result;
    }

    private static tryParseVOCDocument(fileText: string): Document {
        try {
            return parser.parseFromString(fileText, 'application/xml');
        } catch {
            throw new DocumentParsingError();
        }
    }

    protected static parseDocumentIntoImageData(
        document: Document,
        result: VOCImportResult
    ): VOCImportResult {
        try {
            const root = document.getElementsByTagName('annotation')[0];
            const filename = root.getElementsByTagName('filename')[0].textContent;
            const [labeledBoxes, newLabelNames] = this.parseAnnotationsFromFileString(document, result.labelNames);
            result.labelNames = newLabelNames;
            result.fileParseResults.push({
                filename,
                labeledBoxes,
                tags: this.parseTagsFromDocument(root)
            });
            return result;
        } catch {
            throw new AnnotationAssertionError();
        }
    }

    protected static parseAnnotationsFromFileString(document: Document, labelNames: Record<string, LabelName>): 
        [LabelRect[], Record<string, LabelName>] {
        const newLabelNames: Record<string, LabelName> = Object.assign({}, labelNames);
        return [Array.from(document.getElementsByTagName('object')).map(d => {
            const labelName = d.getElementsByTagName('name')[0].textContent;
            const bbox = d.getElementsByTagName('bndbox')[0];
            const xmin = parseInt(bbox.getElementsByTagName('xmin')[0].textContent);
            const xmax = parseInt(bbox.getElementsByTagName('xmax')[0].textContent);
            const ymin = parseInt(bbox.getElementsByTagName('ymin')[0].textContent);
            const ymax = parseInt(bbox.getElementsByTagName('ymax')[0].textContent);
            const rect = {
                x: xmin,
                y: ymin,
                height: ymax - ymin,
                width: xmax - xmin, 
            };
            
            if (!newLabelNames[labelName]) {
                newLabelNames[labelName] = LabelUtil.createLabelName(labelName);
            }
            
            const labelId = newLabelNames[labelName].id;
            return LabelUtil.createLabelRect(labelId, rect);
        }), newLabelNames];
    }

    protected static parseTagsFromDocument(root: Element): ParsedTag[] {
        const tagsElement: Element | undefined = root.getElementsByTagName('tags')[0];
        if (!tagsElement) {
            return [];
        }

        const parsedTags: ParsedTag[] = [];
        Array.from(tagsElement.getElementsByTagName('tag')).forEach((tagElement: Element) => {
            const [name] = TagUtil.normalizeTagNames([tagElement.textContent]);
            const [groupName] = TagUtil.normalizeTagNames([tagElement.getAttribute('group')]);
            if (name && !parsedTags.some((parsedTag: ParsedTag) => parsedTag.name === name)) {
                parsedTags.push(groupName ? { name, groupName } : { name });
            }
        });
        return parsedTags;
    }

    // The tags in the order they are first met, each one in the first group a file gives it. Like
    // the label names, they get the colors of the label palette in their order.
    protected static mapTagConfig(fileParseResults: FileParseResult[]): TagConfig {
        const tags: TagName[] = [];
        const groupNames: string[] = [];
        fileParseResults.forEach((fileParseResult: FileParseResult) => {
            fileParseResult.tags.forEach((parsedTag: ParsedTag) => {
                if (parsedTag.groupName && !groupNames.includes(parsedTag.groupName)) {
                    groupNames.push(parsedTag.groupName);
                }
                if (!tags.some((tag: TagName) => tag.name === parsedTag.name)) {
                    tags.push({ ...parsedTag, color: null });
                }
            });
        });

        const tagConfig: TagConfig = TagUtil.createTagConfig(tags, groupNames);
        return {
            ...tagConfig,
            tags: tagConfig.tags.map((tag: TagName, index: number) => ({
                ...tag,
                color: ArrayUtil.getByInfiniteIndex(Settings.LABEL_COLORS_PALETTE, index)
            }))
        };
    }

    private static mapImageData(): Record<string, ImageData> {
        return LabelsSelector.getImagesData().reduce(
            (imageDataMap: Record<string, ImageData>, imageData: ImageData) => {
                imageDataMap[imageData.fileData.name] = imageData;
                return imageDataMap;
            }, {}
        );
    }
}
