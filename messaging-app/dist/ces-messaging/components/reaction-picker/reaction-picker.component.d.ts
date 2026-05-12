import { EventEmitter } from '@angular/core';
import * as i0 from "@angular/core";
export declare class ReactionPickerComponent {
    show: boolean;
    align: 'left' | 'right';
    emojiSelected: EventEmitter<string>;
    emojis: string[];
    selectEmoji(emoji: string): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<ReactionPickerComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<ReactionPickerComponent, "app-reaction-picker", never, { "show": { "alias": "show"; "required": false; }; "align": { "alias": "align"; "required": false; }; }, { "emojiSelected": "emojiSelected"; }, never, never, true, never>;
}
