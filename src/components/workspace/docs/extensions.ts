import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";

/** font-size via textStyle */
export const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: { fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize || null,
        renderHTML: (a: { fontSize?: string | null }) => (a.fontSize ? { style: `font-size:${a.fontSize}` } : {}),
      } },
    }];
  },
});

/** paragraph/heading indent + spacing */
export const BlockStyle = Extension.create({
  name: "blockStyle",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        indent: { default: 0, parseHTML: (el: HTMLElement) => Number(el.dataset.indent || 0),
          renderHTML: (a: { indent?: number }) => (a.indent ? { "data-indent": a.indent, style: `margin-left:${a.indent * 2}em` } : {}) },
        spacing: { default: null, parseHTML: (el: HTMLElement) => el.dataset.spacing || null,
          renderHTML: (a: { spacing?: string | null }) => (a.spacing ? { "data-spacing": a.spacing, style: `margin-bottom:${a.spacing}` } : {}) },
      },
    }];
  },
});

export function docExtensions(placeholder = "Comece a escrever…") {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline, TextStyle, Color, FontSize, BlockStyle, FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Link.configure({ openOnClick: false, autolink: true }),
    Image.configure({ allowBase64: true }),
    Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
    Placeholder.configure({ placeholder }),
  ];
}
