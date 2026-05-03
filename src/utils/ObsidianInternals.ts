import type { App } from "obsidian";

interface AppWithInternalPlugins extends App {
    plugins?: {
        plugins?: Record<string, unknown>;
    };
}

interface AppWithMobileFlag extends App {
    isMobile?: boolean;
}

interface WindowWithMoment extends Window {
    moment?: {
        locale: () => string;
    };
}

/**
 * Narrow wrappers around Obsidian internals that are not fully typed in the public API.
 */
export class ObsidianInternals {
    static getPluginById<T>(app: App, pluginId: string): T | undefined {
        return (app as AppWithInternalPlugins).plugins?.plugins?.[pluginId] as T | undefined;
    }

    static isMobile(app: App): boolean {
        return (app as AppWithMobileFlag).isMobile === true;
    }

    static getMomentLocale(): string {
        return (window as WindowWithMoment).moment?.locale() || 'en';
    }
}
