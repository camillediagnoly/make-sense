import {
    LocalFileSystemDirectoryHandle,
    LocalFileSystemFileHandle,
} from '../../../interfaces/IFileSystemAccess';
import { LocalImageDirectoryRegistry } from '../LocalImageDirectoryRegistry';

const createDirectoryHandle = (name: string): LocalFileSystemDirectoryHandle => ({
    kind: 'directory',
    name,
    isSameEntry: async function(
        other: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle
    ) {
        return other === this;
    },
});

describe('LocalImageDirectoryRegistry', () => {
    beforeEach(() => {
        LocalImageDirectoryRegistry.clear();
    });

    it('stores and reuses one snapshot for the same folder', async () => {
        const directoryHandle = createDirectoryHandle('images');
        const firstDirectoryId = await LocalImageDirectoryRegistry.register(
            directoryHandle,
            ['one.jpg', 'two.jpg']
        );
        const secondDirectoryId = await LocalImageDirectoryRegistry.register(
            directoryHandle,
            ['three.jpg']
        );

        expect(secondDirectoryId).toBe(firstDirectoryId);
        expect(Array.from(
            LocalImageDirectoryRegistry.getById(firstDirectoryId).knownImageFileNames
        ).sort()).toEqual(['one.jpg', 'three.jpg', 'two.jpg']);
    });

    it('replaces and removes names from the shared folder snapshot', async () => {
        const directoryId = await LocalImageDirectoryRegistry.register(
            createDirectoryHandle('images'),
            ['one.jpg', 'two.jpg']
        );

        LocalImageDirectoryRegistry.replaceKnownImageFileNames(directoryId, ['two.jpg', 'three.jpg']);
        LocalImageDirectoryRegistry.removeKnownImageFileName(directoryId, 'two.jpg');

        expect(Array.from(
            LocalImageDirectoryRegistry.getById(directoryId).knownImageFileNames
        )).toEqual(['three.jpg']);
    });
});
