import { ContextManager } from '../../context/ContextManager';
import { HotKeyAction } from '../../../data/HotKeyAction';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

const dispatchKey = (type: 'keydown' | 'keyup', key: string): void => {
    window.dispatchEvent(new KeyboardEvent(type, { key }));
};

const dispatchKeyFrom = (target: HTMLElement, type: 'keydown' | 'keyup', key: string): void => {
    target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
};

const setActions = (actions: HotKeyAction[]): void => {
    (ContextManager as unknown as { actions: HotKeyAction[] }).actions = actions;
};

describe('ContextManager key combos', () => {
    beforeAll(() => {
        ContextManager.init();
    });

    beforeEach(() => {
        ContextManager.onFocus();
    });

    it('releases a letter whose case changed because Shift was let go first', () => {
        const copy = jest.fn();
        const changeFolder = jest.fn();
        setActions([
            { keyCombo: ['c'], action: copy },
            { keyCombo: ['Shift', 'C'], action: changeFolder },
        ]);

        dispatchKey('keydown', 'Shift');
        dispatchKey('keydown', 'C');
        dispatchKey('keyup', 'Shift');
        dispatchKey('keyup', 'c');

        expect(changeFolder).toHaveBeenCalledTimes(1);
        expect(ContextManager.getActiveCombo()).toEqual([]);

        dispatchKey('keydown', 'c');
        dispatchKey('keyup', 'c');

        expect(copy).toHaveBeenCalledTimes(1);
    });

    describe('while typing in a text field', () => {
        let previousImage: jest.Mock;
        let closePopup: jest.Mock;

        beforeEach(() => {
            previousImage = jest.fn();
            closePopup = jest.fn();
            setActions([
                { keyCombo: ['a'], action: previousImage },
                { keyCombo: ['Escape'], action: closePopup },
            ]);
        });

        afterEach(() => {
            document.body.innerHTML = '';
        });

        const createField = (html: string): HTMLElement => {
            document.body.innerHTML = html;
            return document.body.firstElementChild as HTMLElement;
        };

        it('ignores shortcuts typed into a text input', () => {
            const input = createField('<input type="text" />');

            dispatchKeyFrom(input, 'keydown', 'a');
            dispatchKeyFrom(input, 'keyup', 'a');

            expect(previousImage).not.toHaveBeenCalled();
            expect(ContextManager.getActiveCombo()).toEqual([]);
        });

        it('ignores shortcuts typed into a textarea', () => {
            const textarea = createField('<textarea></textarea>');

            dispatchKeyFrom(textarea, 'keydown', 'a');
            dispatchKeyFrom(textarea, 'keyup', 'a');

            expect(previousImage).not.toHaveBeenCalled();
        });

        it('still lets Escape through to close a popup', () => {
            const input = createField('<input type="text" />');

            dispatchKeyFrom(input, 'keydown', 'Escape');
            dispatchKeyFrom(input, 'keyup', 'Escape');

            expect(closePopup).toHaveBeenCalledTimes(1);
        });

        it('keeps shortcuts working on inputs that do not take text', () => {
            const checkbox = createField('<input type="checkbox" />');

            dispatchKeyFrom(checkbox, 'keydown', 'a');
            dispatchKeyFrom(checkbox, 'keyup', 'a');

            expect(previousImage).toHaveBeenCalledTimes(1);
        });

        it('fires shortcuts again once the key comes from outside the field', () => {
            const input = createField('<input type="text" />');

            dispatchKeyFrom(input, 'keydown', 'a');
            dispatchKeyFrom(input, 'keyup', 'a');
            dispatchKey('keydown', 'a');
            dispatchKey('keyup', 'a');

            expect(previousImage).toHaveBeenCalledTimes(1);
        });
    });
});
