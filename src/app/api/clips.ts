export interface Clip {
  id: string;
  accountId: string;
  workspaceId: string;
  workspaceImage: string;
  workspaceName: string;
  source: string;
  ext: string;
  type: "video" | "photo" | "livePhoto" | "animated" | "audio" | "nonMedia";
  size: number; // Will be set by server but required for canUpload check
  status:
    | "created"
    | "uploaded"
    | "transcoding"
    | "transcoded"
    | "failed"
    | "nonTranscodable";
  bookmarked: boolean;
  createdAt: string;
  recordedAt: string;
  updatedAt: string;
  title?: string;
  description?: string;
  importedName?: string;
  duration?: number;
  height: number;
  width: number;
  rotation: number;
  visible?: boolean;
  ownerName: string;
  owner: {
    ownerName: string;
    ownerAvatar: string;
  };
  avatar: string | null;
  assets: {
    image: string;
    video?: string;
    previewVideo?: string;
    seekVideo?: string;
    pdf?: string;
    original?: string;
  };
  mime?: string;
  altResolutions: {
    ext: string; // 'MP4'
    height: number; // 720
    width: number; // 1280
    id: string;
  }[];
  hasOpenDiscussions?: boolean;
  openDiscussionCount?: number;
  openCommentCount?: number;
  assetId: string;
  version: number;
  assetVersionCount?: number;
  isDefault: boolean;
  resolution?: number;
  boardCount?: number;
  tagCount?: number;
}

export interface ClipsListResponse {
  data: {
    total: number;
    clips: Clip[];
  };
  pagination: {
    hasMore: boolean;
    cursor: null | string;
  };
}

import { ROOT_BOARD_ID, SHORT_ID } from "./boards";

// Sort fields verified against the live API.
export type SortFieldName = "dateModified" | "dateCreated" | "dateTaken" | "name" | "size";
export interface SortField {
  name: SortFieldName;
  direction: "asc" | "desc";
}

export const fetchAssets = ({
  boardId = ROOT_BOARD_ID,
  cursor,
  limit = 30,
  search,
  sortField = { direction: "desc", name: "dateModified" },
  includeDescendants = false,
}: {
  boardId?: string;
  cursor: string | null;
  limit?: number;
  search?: string;
  sortField?: SortField;
  // When true (used for search), results include assets in nested boards.
  includeDescendants?: boolean;
}): Promise<ClipsListResponse> =>
  fetch(`https://api.air.inc/shorturl/${SHORT_ID}/clips/search`, {
    method: "post",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      limit,
      type: "all",
      withOpenDiscussionStatus: true,
      filters: {
        board: {
          is: boardId,
        },
      },
      boardId,
      sortField,
      ...(search ? { search } : {}),
      ...(includeDescendants ? { descendantBoardId: boardId } : {}),
      cursor,
    }),
  }).then((r) => r.json());
