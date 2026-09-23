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
});
