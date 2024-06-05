import ytpl from "@distube/ytpl";
import ytsr from "@distube/ytsr";
import ytdl from "@distube/ytdl-core";
import { clone, parseNumber, toSecond } from "./util";
import { DisTubeError, ExtractorPlugin, Playlist, type ResolveOptions, Song, formatDuration } from "distube";

export type YouTubePluginOptions = {
  /**
   * YouTube Cookies
   */
  cookies?: ytdl.Cookie[];
  /**
   * ytdl-core options
   */
  ytdlOptions?: ytdl.getInfoOptions;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const playError = require("@distube/ytdl-core/lib/utils").playError;

export class YouTubePlugin extends ExtractorPlugin {
  #cookies?: ytdl.Cookie[];
  cookies?: ytdl.Cookie[];
  ytdlOptions: ytdl.getInfoOptions;

  constructor(options?: YouTubePluginOptions) {
    super();
    this.cookies = this.#cookies = options?.cookies ? clone(options.cookies) : undefined;
    this.ytdlOptions = options?.ytdlOptions ? clone(options.ytdlOptions) : {};
    this.ytdlOptions.agent = ytdl.createAgent(this.cookies);
  }

  get #ytdlOptions(): ytdl.getInfoOptions {
    if (this.cookies !== this.#cookies) this.ytdlOptions.agent = ytdl.createAgent((this.#cookies = this.cookies));
    return this.ytdlOptions;
  }
  get ytCookie(): string {
    const agent = this.ytdlOptions.agent;
    if (!agent) return "";
    const { jar } = agent;
    return jar.getCookieStringSync("https://www.youtube.com");
  }

  validate(url: string): boolean {
    if (ytdl.validateID(url) || ytpl.validateID(url)) return true;
    return false;
  }
  async resolve<T>(url: string, options: ResolveOptions<T>) {
    if (ytdl.validateID(url)) {
      const info = await ytdl.getBasicInfo(url, this.#ytdlOptions);
      return new YouTubeSong(this, info, options);
    } else if (ytpl.validateID(url)) {
      const info = await ytpl(url, { limit: Infinity, requestOptions: { headers: { cookie: this.ytCookie } } });
      return new YouTubePlaylist(this, info, options);
    }
    throw new DisTubeError("CANNOT_RESOLVE_SONG", url);
  }
  async getStreamURL<T = unknown>(song: YouTubeSong<T>): Promise<string> {
    if (!song.url || !ytdl.validateURL(song.url)) throw new DisTubeError("CANNOT_RESOLVE_SONG", song);
    const info = await ytdl.getInfo(song.url, this.#ytdlOptions);
    if (!info.formats?.length) throw new DisTubeError("UNAVAILABLE_VIDEO");
    const err = playError(info.player_response, ["UNPLAYABLE", "LIVE_STREAM_OFFLINE", "LOGIN_REQUIRED"]);
    if (err) throw err;
    const newSong = new YouTubeSong(this, info, {});
    song.ageRestricted = newSong.ageRestricted;
    song.views = newSong.views;
    song.likes = newSong.likes;
    song.thumbnail = newSong.thumbnail;
    song.related = newSong.related;
    song.chapters = newSong.chapters;
    song.storyboards = newSong.storyboards;
    const format = info.formats
      .filter(f => f.hasAudio && (newSong.duration < 10 * 60 || f.hasVideo) && (!newSong.isLive || f.isHLS))
      .sort((a, b) => Number(b.audioBitrate) - Number(a.audioBitrate) || Number(a.bitrate) - Number(b.bitrate))[0];
    if (!format) throw new DisTubeError("UNPLAYABLE_FORMATS");
    return format.url;
  }
  async getRelatedSongs(song: YouTubeSong): Promise<Song[]> {
    return (song.related ? song.related : (await ytdl.getBasicInfo(song.url!, this.#ytdlOptions)).related_videos).map(
      r => new YouTubeRelatedSong(this, r),
    );
  }
  async searchSong<T>(query: string, options: ResolveOptions<T>): Promise<Song<T> | null> {
    const result = await this.search(query, { type: SearchResultType.VIDEO, limit: 1 });
    if (!result?.[0]) return null;
    const info = result[0];
    return new Song(
      {
        plugin: this,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.name,
        url: info.url,
        thumbnail: info.thumbnail,
        duration: info.duration,
        views: info.views,
        uploader: info.uploader,
      },
      options,
    );
  }

  search(
    string: string,
    options?: { type?: SearchResultType.VIDEO; limit?: number; safeSearch?: boolean },
  ): Promise<Array<SearchResultVideo>>;
  search(
    string: string,
    options: { type: SearchResultType.PLAYLIST; limit?: number; safeSearch?: boolean },
  ): Promise<Array<SearchResultPlaylist>>;
  search(
    string: string,
    options?: { type?: SearchResultType; limit?: number; safeSearch?: boolean },
  ): Promise<Array<SearchResult>>;
  /**
   * Search for a song.
   *
   * @param query              - The string search for
   * @param options            - Search options
   * @param options.limit      - Limit the results
   * @param options.type       - Type of results (`video` or `playlist`).
   * @param options.safeSearch - Whether or not use safe search (YouTube restricted mode)
   *
   * @returns Array of results
   */
  async search(
    query: string,
    options: {
      type?: SearchResultType;
      limit?: number;
      safeSearch?: boolean;
    } = {},
  ): Promise<Array<SearchResult>> {
    const { items } = await ytsr(query, {
      type: SearchResultType.VIDEO,
      limit: 10,
      safeSearch: false,
      ...options,
      requestOptions: { headers: { cookie: this.ytCookie } },
    });
    return items.map(i => {
      if (i.type === "video") return new SearchResultVideo(i);
      return new SearchResultPlaylist(i);
    });
  }
}

export class YouTubeSong<T = unknown> extends Song<T> {
  chapters?: ytdl.Chapter[];
  storyboards?: ytdl.storyboard[];
  related?: ytdl.relatedVideo[];
  constructor(plugin: YouTubePlugin, info: ytdl.videoInfo, options: ResolveOptions<T>) {
    const i = info.videoDetails;
    super(
      {
        plugin,
        source: "youtube",
        playFromSource: true,
        id: i.videoId,
        name: i.title,
        isLive: Boolean(i.isLive),
        duration: i.isLive ? 0 : toSecond(i.lengthSeconds),
        url: i.video_url || `https://youtu.be/${i.videoId}`,
        thumbnail: i.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
        views: parseNumber(i.viewCount || (<any>i).view_count || (<any>i).views),
        likes: parseNumber(i.likes),
        uploader: {
          name: i.author?.name || i.author?.user,
          url:
            i.author?.channel_url || i.author?.external_channel_url || i.author?.user_url || i.author?.id
              ? `https://www.youtube.com/channel/${i.author.id}`
              : i.author?.user
                ? `https://www.youtube.com/${i.author.user}`
                : undefined,
        },
        ageRestricted: Boolean(i.age_restricted),
      },
      options,
    );
    this.chapters = i.chapters || [];
    this.storyboards = i.storyboards || [];
    this.related = info.related_videos || [];
  }
}

export class YouTubePlaylist<T> extends Playlist<T> {
  constructor(plugin: YouTubePlugin, info: ytpl.result, options: ResolveOptions<T>) {
    const songs = info.items.map(
      i =>
        new Song({
          plugin,
          playFromSource: true,
          source: "youtube",
          id: i.id,
          name: i.title,
          url: i.url,
          thumbnail: i.thumbnail,
          duration: toSecond(i.duration),
          isLive: Boolean((<any>i).isLive),
          uploader: {
            name: i.author?.name,
            url:
              (<any>i).author?.url || (<any>i).author?.channelID
                ? `https://www.youtube.com/channel/${(<any>i).author.channelID}`
                : undefined,
          },
        }),
    );
    super(
      {
        source: "youtube",
        id: info.id,
        name: info.title,
        url: info.url,
        thumbnail: (<any>info).thumbnail?.url,
        songs,
      },
      options,
    );
  }
}

export class YouTubeRelatedSong extends Song {
  constructor(plugin: YouTubePlugin, info: ytdl.relatedVideo) {
    super({
      plugin,
      source: "youtube",
      playFromSource: true,
      id: info.id,
      name: info.title,
      url: `https://youtu.be/${info.id}`,
      thumbnail: info.thumbnails?.sort((a, b) => b.width - a.width)?.[0]?.url,
      isLive: Boolean(info.isLive),
      duration: info.isLive ? 0 : toSecond(info.length_seconds),
      views: parseNumber(info.view_count),
      uploader:
        typeof info.author === "string"
          ? {
              name: info.author,
            }
          : {
              name: info.author?.name || info.author?.user,
              url:
                info.author?.channel_url ||
                info.author?.external_channel_url ||
                info.author?.user_url ||
                info.author?.id
                  ? `https://www.youtube.com/channel/${info.author.id}`
                  : info.author?.user
                    ? `https://www.youtube.com/${info.author.user}`
                    : undefined,
            },
    });
  }
}

/**
 * Search result types:
 *
 * - `VIDEO` = `"video"`
 * - `PLAYLIST` = `"playlist"`
 */
export enum SearchResultType {
  VIDEO = "video",
  PLAYLIST = "playlist",
}

abstract class ISearchResult {
  abstract type: SearchResultType;
  /**
   * YouTube video or playlist id
   */
  id: string;
  /**
   * Video or playlist title.
   */
  name: string;
  /**
   * Video or playlist URL.
   */
  url: string;
  /**
   * Video or playlist uploader
   */
  uploader: {
    name?: string;
    url?: string;
  };

  /**
   * Create a search result
   *
   * @param info - ytsr result
   */
  constructor(info: ytsr.Video | ytsr.Playlist) {
    this.id = info.id;
    this.name = info.name;
    this.url = info.url;
    this.uploader = {
      name: undefined,
      url: undefined,
    };
  }
}

/**
 * A class representing a video search result.
 */
export class SearchResultVideo extends ISearchResult {
  /**
   * Type of SearchResult
   */
  type: SearchResultType.VIDEO;
  /**
   * Video views count
   */
  views: number;
  /**
   * Indicates if the video is an active live.
   */
  isLive: boolean;
  /**
   * Video duration.
   */
  duration: number;
  /**
   * Formatted duration string `hh:mm:ss` or `mm:ss`.
   */
  formattedDuration: string;
  /**
   * Video thumbnail.
   */
  thumbnail: string;
  constructor(info: ytsr.Video) {
    super(info);
    if (info.type !== "video") throw new DisTubeError("INVALID_TYPE", "video", info.type, "type");
    this.type = SearchResultType.VIDEO;
    this.views = info.views;
    this.isLive = info.isLive;
    this.duration = this.isLive ? 0 : toSecond(info.duration);
    this.formattedDuration = this.isLive ? "Live" : formatDuration(this.duration);
    this.thumbnail = info.thumbnail;
    this.uploader = {
      name: info.author?.name,
      url: info.author?.url,
    };
  }
}

/**
 * A class representing a playlist search result.
 */
export class SearchResultPlaylist extends ISearchResult {
  /**
   * Type of SearchResult
   */
  type: SearchResultType.PLAYLIST;
  /**
   * Number of videos in the playlist
   */
  length: number;
  constructor(info: ytsr.Playlist) {
    super(info);
    if (info.type !== "playlist") throw new DisTubeError("INVALID_TYPE", "playlist", info.type, "type");
    this.type = SearchResultType.PLAYLIST;
    this.length = info.length;
    this.uploader = {
      name: info.owner?.name,
      url: info.owner?.url,
    };
  }
}

/**
 * A video or playlist search result
 */
export type SearchResult = SearchResultVideo | SearchResultPlaylist;