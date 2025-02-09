import { test, expect } from "vitest";
import { Formatter } from "../src/formatter";
import { RangeEditor } from "common-cursor/editor";
import { NodeToString } from "common-cursor/helper";

function createFormatter(root: HTMLElement) : Formatter {
    const editor = new RangeEditor(
        {
        },
        root,
    );
    return new Formatter(
        {
        },
        editor
    );
}

test('formatter/preventFormat/case1', () => {
    const root = document.createElement("div")
    root.innerHTML = "<p>hello<b>world</b></p>"
    const formatter = createFormatter(root);

    expect(formatter._preventFormat(root, "b")).toEqual(-2);

    const rootStr = NodeToString(root);

    expect(rootStr).toEqual("<div><p>helloworld</p></div>");
});

test('formatter/preventFormat/case2', () => {
    const root = document.createElement("div")
    root.innerHTML = "<p>hello<b>wo<b>rld</b></b></p>"
    const formatter = createFormatter(root);

    expect(formatter._preventFormat(root, "b")).toEqual(-4);

    const rootStr = NodeToString(root);

    expect(rootStr).toEqual("<div><p>helloworld</p></div>");
});

test('formatter/unsurround/case1', () => {
    const root = document.createElement("div")
    root.innerHTML = "<p>hello<b>wo<b>rld</b></b></p>"
    const formatter = createFormatter(root);


    expect(formatter._unsurrondNode(root.childNodes[0] as Element)).toEqual(-2);
    expect(NodeToString(root)).toEqual("<div>hello<b>wo<b>rld</b></b></div>");
});


test('formatter/preventFormat/concatText', () => {
    const root = document.createElement("div")
    root.innerHTML = "hello<b>wo</b>rld"
    const formatter = createFormatter(root);

    expect(formatter._preventFormat(root, "b")).toEqual(-2);
    expect(NodeToString(root)).toEqual("<div>helloworld</div>");
    // should not have multiple text segments
    expect(root.childNodes.length).toEqual(1);
});

