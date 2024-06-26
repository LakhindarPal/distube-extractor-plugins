export interface RevisionResponse {
  action: string;
  afterForComments: string;
  backgroundId: null;
  canChangePinState: boolean;
  canComment: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canPin: boolean;
  caption: string;
  channelId: string;
  clientId: string;
  comments: Comment[];
  counters: Counters;
  createdOn: Date;
  creator: Creator;
  id: string;
  initiatorReaction: null;
  isBoosted: boolean;
  isCommentingAllowed: boolean;
  isExclusive: boolean;
  isExplicit: boolean;
  isLiked: boolean;
  isPinned: boolean;
  isPostedAsBand: boolean;
  message: string;
  permissions: RevisionPermissions;
  postCompositeId: string;
  reactions: Reaction[];
  revision: Revision;
  state: string;
  type: string;
}

export interface Comment {
  canDelete?: boolean;
  content: string;
  counters: CommentCounters;
  createdOn: Date;
  creator: Creator;
  id: number;
  isCreatedByPostCreator?: boolean;
  isLiked: boolean;
  isLikedByPostCreator?: boolean;
  permissions: CommentPermissions;
  timestamp?: null;
}

export interface CommentCounters {
  likes: number;
  replies: number;
}

export interface Creator {
  followingState?: string;
  id: string;
  isFollower?: boolean;
  isTippable: boolean;
  isVerified: boolean;
  name: string;
  picture: Picture;
  username: string;
  collaborationStatus?: string;
  status?: string;
}

export interface Picture {
  blur: Blur;
  isDefault: boolean;
  l: string;
  m: string;
  s: string;
  xs: string;
  url: string;
  original?: string;
  color?: string;
}

export interface Blur {
  xs: string;
  s: string;
  m: string;
  l: string;
}

export interface CommentPermissions {
  delete: boolean;
}

export interface Counters {
  comments: number;
  likes: number;
  plays?: number;
  reactions: number;
}

export interface RevisionPermissions {
  comment: boolean;
  seeExclusive: boolean;
}

export interface Reaction {
  count: number;
  reaction: string;
}

export interface Revision {
  canEdit: boolean;
  canEditSettings: boolean;
  canMaster: boolean;
  canPublish: boolean;
  counters: RevisionCounters;
  createdOn: Date;
  creator: Creator;
  description: string;
  genres: Genre[];
  id: string;
  isFork: boolean;
  isLiked: boolean;
  isPublic: boolean;
  lyrics: null;
  mastering: null;
  mixdown: Mixdown;
  parentId: null;
  place: null;
  song: Song;
  tags: any[];
}

export interface RevisionCounters extends Omit<Counters, "reactions"> {
  forks: number;
}

export interface Genre {
  id: string;
  name: string;
}

export interface Mixdown {
  duration: number;
  file: string;
  id: string;
  status: string;
  waveform: string;
}

export interface Song {
  author: Author;
  counters: SongCounters;
  id: string;
  isFork: boolean;
  isForkable: boolean;
  name: string;
  originalSongId: null;
  picture: Picture;
  slug: string;
}

export interface Author {
  conversationId: null;
  id: string;
  name: string;
  type: string;
  username: string;
}

export interface SongCounters extends RevisionCounters {
  collaborators: number;
  publicRevisions: number;
}
