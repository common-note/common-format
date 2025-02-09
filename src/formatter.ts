import type { Anchor, ContainerType } from "common-cursor/interface";
import type { RangeEditor } from "common-cursor/editor";


const DEFAULT_SUPPORT_TAGS = ["b", "i", "u", "s", "sub", "sup"];

export interface FormatConfig {
    supportTags?: string[];
}

export interface FormatPayload {
    start: number;
    end: number;
    format: string;
}

export interface FormatResult {
    start: Anchor;
    end: Anchor;
    count: number;
}

export interface FormatDataResult {
    start: number;
    end: number;
    action: "surround" | "unsurround"
}

export interface OffsetBias {
    start: number;
    end: number;
}

/**
 * a stateful formatter.  
 * 
 * case1. 
 * 
 */
export class Formatter {
    config: FormatConfig;
    editor: RangeEditor;
    root: Element;
    constructor(config: FormatConfig, editor: RangeEditor) {
        this.config = config;
        this.config.supportTags = config.supportTags || DEFAULT_SUPPORT_TAGS
        this.editor = editor;
        this.root = editor.root;
    }

    _insertEmpty(tag: string, anchor: Anchor): FormatResult {
        const node = document.createElement(tag);
        node.textContent = ' ';
        if (anchor.container instanceof Text) {
            anchor.container.splitText(anchor.offset);
            anchor.container.after(node);
            // anchor.container.parentNode?.(node, anchor.container);
            return {
                start: this.editor.getBoundaryAnchorInsideNode({
                    container: node,
                    step: {
                        direction: 'left',
                        shift: false,
                        stride: "char",
                    },
                }),
                end: this.editor.getBoundaryAnchorInsideNode({
                    container: node,
                    step: {
                        direction: 'right',
                        shift: false,
                        stride: "char",
                    },
                }),
                count: 3,
            };
        } 
        if (anchor.container instanceof Element) {
            this.editor._insertBefore(node, anchor.container);
            return {
                start: anchor,
                end: anchor,
                count: 3,
            };
        }
        throw new Error("Invalid anchor element");
    }

    _expandWord(tag: string, anchor: Anchor): FormatResult {
        const left = this.editor.getWordBoundaryAnchorInsideNode({
            container: anchor.container,
            offset: anchor.offset,
            step: {
                direction: 'left',
                stride: 'word',
            },
        })
        const right = this.editor.getWordBoundaryAnchorInsideNode({
            container: anchor.container,
            offset: anchor.offset,
            step: {
                direction: 'right',
                stride: 'word',
            },
        })
        return this._makeWord(tag, left, right);

    }

    _makeWord(tag: string, start: Anchor, end: Anchor): FormatResult {
        const node = document.createElement(tag);
        const range = document.createRange();
        if (this._inTag(start, tag) || this._inTag(end, tag)) {
            throw new Error("make tag already exists in left or right anchor");
        }
        range.setStart(start.container, start.offset);
        range.setEnd(end.container, end.offset);
        range.surroundContents(node);
        const eraseBias = this._preventFormat(node, tag);
        const ret = {
            start: this.editor.getBoundaryAnchorInsideNode({
                container: node,
                step: {
                    direction: 'left',
                    stride: 'char',
                },
            }),
            end: this.editor.getBoundaryAnchorInsideNode({
                container: node,
                step: {
                    direction: 'right',
                    stride: 'char',
                },
            }),
            count: 2 + eraseBias,   
        };
        return ret;
    }

    _inTag(anchor: Anchor, tag: string): HTMLElement | null {
        let current: ContainerType | null = anchor.container;
        while (current) {
            if (current instanceof HTMLElement && current.tagName.toLowerCase() === tag) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    _concatText(node: Text, direction: "left" | "right"): boolean {
        if (direction === "left") {
        let prev = this.editor._getNeighborSibling({container:node, step: {direction: "left", stride:"char"}})
            if (prev && prev instanceof Text) {
                node.textContent = (prev.textContent || "") + (node.textContent || "");
                prev.remove();
                prev = this.editor._getNeighborSibling({container:node, step: {direction: "left", stride:"char"}})
            }
            return true;
        }

        let next = this.editor._getNeighborSibling({container:node, step: {direction: "right", stride:"char"}})
        if (next && next instanceof Text) {
            node.textContent = (node.textContent || "") + (next.textContent || "");
            next.remove();
            next = this.editor._getNeighborSibling({container:node, step: {direction: "right", stride:"char"}})
        }
        return true;
    }


    concatText(nodes: ContainerType[]): ContainerType[] {
        for (let i = 0; i < nodes.length - 1; i++) {
            if (nodes[i] instanceof Text && nodes[i].parentElement) {
                this._concatText(nodes[i] as Text, "right");
            }
        }
        return nodes.filter(node => node.parentElement);
    }
    /**
     * 
     * @param node 
     * @returns -2 means two token are removed
     */
    _unsurrondNode(node :Element): FormatResult {
        const shouldIgnore = this.editor.shouldIgnore(node);
        let nodes: ContainerType[] = [];
        for (let i = node.childNodes.length - 1; i >= 0 ; i-- ){
            const ret = this.editor._insertAfter(node.childNodes[i], node, false);
            if (ret !== nodes[nodes.length - 1]) {
                nodes.push(ret);
            }
        }
        nodes.reverse();
        node.remove();
        nodes = this.concatText(nodes);
        if (shouldIgnore) {
            return {
                start: this.editor.getBoundaryAnchorOutsideNode({container:nodes[0], step: {direction: "left", stride:"char"}}),
                end: this.editor.getBoundaryAnchorOutsideNode({container:nodes[nodes.length - 1], step: {direction: "right", stride:"char"}}),
                count: 0,
            };
        }
        const ret = {
            start: this.editor.getBoundaryAnchorOutsideNode({container:nodes[0], step: {direction: "left", stride:"char"}}),
            end: this.editor.getBoundaryAnchorOutsideNode({container:nodes[nodes.length - 1], step: {direction: "right", stride:"char"}}),
            count: -2,
        };
        return ret;
    }

    /**
     * 
     * @param node 
     * @param tag 
     * @returns number of tokens removed
     */
    _preventFormat(node: HTMLElement, tag: string): number {
        let el = node.querySelector(tag);
        let count = 0;
        while (el) {
            count += this._unsurrondNode(el as Element).count;
            el = node.querySelector(tag);
        }
        return count;
    }

    format(tag: string): FormatResult {
        const range = this.editor.getRange();

        const startTagNode = this._inTag(range.start, tag);
        if (range.collapsed) {
            // return this._insertEmpty(tag, { container: range.start.container, offset: range.start.offset });
            if (startTagNode) {
                return this._unsurrondNode(startTagNode);
            } 
            return this._expandWord(tag, { container: range.start.container, offset: range.start.offset });
        } 
            const startInTag = this._inTag(range.start, tag);
            const endInTag = this._inTag(range.end, tag);
            if (startInTag && endInTag) {
                if (startInTag === endInTag) {
                    return this._unsurrondNode(startInTag);
                } 
                    throw new Error("start and end are in tag");
            } 
            if (startInTag) {
                const start = this._unsurrondNode(startInTag);
                
                let end: Anchor;
                if (range.end.container instanceof Text) {
                    end = range.end;
                }else {
                    end = this.editor.getBoundaryAnchorOutsideNode({container:range.end.container, step: {direction: "right", stride:"char"}})
                }
                return {
                    start: start.start,
                    end: end,
                    count: start.count,
                }
            } 
            if (endInTag) { 
                const end = this._unsurrondNode(endInTag);
                let start: Anchor;
                if (range.start.container instanceof Text) {
                    start = range.start;
                }else {
                    start = this.editor.getBoundaryAnchorOutsideNode({container:range.start.container, step: {direction: "left", stride:"char"}})
                }
                return {
                    start: start,
                    end: end.end,
                    count: end.count,
                }
            } 
        return this._makeWord(tag, range.start, range.end);
    }

    // /**
    //  * 
    //  * @param payload 
    //  * @returns 
    //  */
    // apply(payload: FormatPayload): FormatDataResult {
    //     const start = this.editor.getAnchorByOffset(payload.start);
    //     const collapsed = payload.start === payload.end;
    //     const tag = payload.format;
    //     const startTagNode = this._inTag(start, tag)
    //     let rangeResult: AnchorRange;
    //     if (collapsed) {
    //         if (startTagNode) {
    //             rangeResult = this._preventFormat(startTagNode, tag);
    //         } else {
    //             rangeResult = this._expandWord(tag, { container: start.container, offset: start.offset });
    //         }
    //     } else {
    //         const endInTag = this._inTag(range.end, tag);
    //         if (endInTag) {
    //             rangeResult = this._makeWord(tag, range.start, range.end);
    //         } else {
    //             rangeResult = this._makeWord(tag, range.start, range.end);
    //         }
    //     }
    //     const formatResult: FormatDataResult = {
    //         start: rangeResult.start.offset,
    //         end: rangeResult.end.offset,
    //         action: "surround",
    //     }
        
    //     return rangeResult;
    // }


}