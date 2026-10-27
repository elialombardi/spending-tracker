import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from './baseApi'
import { getAuthState, subscribeToAuth } from '../auth'

export const store = configureStore({
    reducer: {
        // Add your API reducers here
        // Example: locationsApi: locationsApi.reducer,
        baseApi: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(baseApi.middleware),
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch

let accessToken = getAuthState().session?.access_token
subscribeToAuth(() => {
    const nextToken = getAuthState().session?.access_token
    if (nextToken !== accessToken) {
        accessToken = nextToken
        store.dispatch(baseApi.util.resetApiState())
    }
})