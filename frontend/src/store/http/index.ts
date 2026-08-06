// HTTP request state tracking (mirrors TherapyLake pattern)

// Types
export const APPEND_LOADING = 'APPEND_LOADING';
export const REMOVE_LOADING = 'REMOVE_LOADING';
export const APPEND_ERROR = 'APPEND_ERROR';
export const REMOVE_ERROR = 'REMOVE_ERROR';
export const APPEND_SUCCESS = 'APPEND_SUCCESS';
export const REMOVE_SUCCESS = 'REMOVE_SUCCESS';

// Actions
export const httpActions = {
    appendLoading: (type: string) => ({ type: APPEND_LOADING, payload: type }),
    removeLoading: (type: string) => ({ type: REMOVE_LOADING, payload: type }),
    appendError: (type: string, error: string) => ({ type: APPEND_ERROR, payload: { type, error } }),
    removeError: (type: string) => ({ type: REMOVE_ERROR, payload: type }),
    appendSuccess: (type: string) => ({ type: APPEND_SUCCESS, payload: type }),
    removeSuccess: (type: string) => ({ type: REMOVE_SUCCESS, payload: type }),
};

// State
interface HttpState {
    loading: string[];
    errors: { type: string; error: string }[];
    successes: string[];
}

const initialState: HttpState = {
    loading: [],
    errors: [],
    successes: [],
};

// Reducer
export const httpReducer = (state = initialState, action: any): HttpState => {
    switch (action.type) {
        case APPEND_LOADING:
            return { ...state, loading: [...state.loading, action.payload] };
        case REMOVE_LOADING:
            return { ...state, loading: state.loading.filter((t) => t !== action.payload) };
        case APPEND_ERROR:
            return { ...state, errors: [...state.errors, action.payload] };
        case REMOVE_ERROR:
            return { ...state, errors: state.errors.filter((e) => e.type !== action.payload) };
        case APPEND_SUCCESS:
            return { ...state, successes: [...state.successes, action.payload] };
        case REMOVE_SUCCESS:
            return { ...state, successes: state.successes.filter((s) => s !== action.payload) };
        default:
            return state;
    }
};
