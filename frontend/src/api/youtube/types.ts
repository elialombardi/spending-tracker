export interface YoutubeChannel {
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    customUrl: string;
    country: string;
    lastSyncedAt: string | null;
    tags: Tag[];
    recentVideos?: Video[];
}

export interface Video {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    publishedAt: string;
    duration: string;
    viewCount: number;
    url: string;
}

export interface Tag {
    id: string;
    name: string;
    description: string;
    color: string;
    channelCount: number;
}

export interface CreateTagRequest {
    name: string;
    description: string;
    color: string;
}

export interface UpdateTagRequest {
    name?: string;
    description?: string;
    color?: string;
}

export interface AddTagsRequest {
    tagIds: string[];
}

export interface RemoveTagsRequest {
    tagIds: string[];
}

export interface SyncLog {
    id: string;
    type: 'all' | 'channel' | 'tag';
    status: 'pending' | 'running' | 'completed' | 'failed';
    totalChannels: number;
    processedChannels: number;
    totalVideosAdded: number;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
}

export interface SyncStatus {
    isSyncing: boolean;
    lastSync?: SyncLog;
    currentSync?: SyncLog;
}