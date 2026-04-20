import {ImageData, LabelName, LabelRect} from '../../../store/labels/types';
import {LabelUtil} from "../../../utils/LabelUtil";
import {AnnotationImporter} from '../AnnotationImporter';
import {LabelsSelector} from '../../../store/selectors/LabelsSelector';
import { FileUtil } from '../../../utils/FileUtil';

type FileParseResult = {
    filename: string,
    labeledBoxes: LabelRect[]
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

    constructor(fileNames: string[], imagesData: ImageData[], labelNames: LabelName[]) {
        super('Some annotation files could not be imported.');
        this.name = "PartialVOCImportError";
        this.fileNames = fileNames;
        this.imagesData = imagesData;
        this.labelNames = labelNames;
    }
}

const parser = new DOMParser();

export class VOCImporter extends AnnotationImporter {
    private static readonly READ_BATCH_SIZE = 100;

    public import(
        filesData: File[],
        onSuccess: (imagesData: ImageData[], labelNames: LabelName[]) => any,
        onFailure: (error?:Error) => any
    ): void {
        try {
            const inputImagesData: Record<string, ImageData> = VOCImporter.mapImageData();

            this.loadAndParseFiles(filesData).then(results => {
                for (const result of results.fileParseResults) {
                    if (inputImagesData[result.filename]) {
                        inputImagesData[result.filename].labelRects = result.labeledBoxes;
                    }
                }

                const imagesData = Array.from(Object.values(inputImagesData));
                const labelNames = Array.from(Object.values(results.labelNames));

                if (results.failedFiles.length !== 0) {
                    onFailure(new PartialVOCImportError(results.failedFiles, imagesData, labelNames));
                    return;
                }

                onSuccess(imagesData, labelNames);
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
                labeledBoxes
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

    private static mapImageData(): Record<string, ImageData> {
        return LabelsSelector.getImagesData().reduce(
            (imageDataMap: Record<string, ImageData>, imageData: ImageData) => {
                imageDataMap[imageData.fileData.name] = imageData;
                return imageDataMap;
            }, {}
        );
    }
}
