import { useEffect, useRef } from 'react';
import type React from 'react';
import { Formatter } from '../../src/formatter';
import { RangeEditor } from 'common-cursor/editor';


interface EditableDivProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  stride?: 'char' | 'word' | 'softline';
}

export const EditableManually: React.FC<EditableDivProps> = ({
  initialContent = '',
  stride = 'char',
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const formatterRef = useRef<Formatter | null>(null);

  useEffect(() => {
    if (!divRef.current) {
      return;
    }
    const editor = new RangeEditor({ shouldIgnore: (node) => node instanceof HTMLElement && node.tagName === 'LABEL' }, divRef.current);
    // 使用 Formatter 替代 AnchorQuery
    formatterRef.current = new Formatter({ shouldIgnore: (node) => node instanceof HTMLElement && node.tagName === 'LABEL' }, editor);

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const range = editor.normalizeRange();
      if (!range) return;
      console.log(range);
    };

    // 添加键盘事件处理
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!formatterRef.current) return;

      if (e.key === 'b' && (e.ctrlKey || e.metaKey
      )) {
        e.preventDefault();
        e.stopPropagation();
        const range = formatterRef.current.format('b');
        let oldRange = document.getSelection()?.getRangeAt(0);
        if (!oldRange) {
          oldRange = document.createRange();
          document.getSelection()?.addRange(oldRange);
        };
        oldRange.setStart(range.start.container, range.start.offset);
        oldRange.setEnd(range.end.container, range.end.offset);
        return;
      }
    };

    divRef.current.addEventListener('keydown', handleKeyDown);
    divRef.current.addEventListener('mouseup', handleMouseUp);
    // 清理事件监听器
    return () => {
      divRef.current?.removeEventListener('keydown', handleKeyDown);
      divRef.current?.removeEventListener('mouseup', handleMouseUp);
    };
  }, [stride]); // 添加 stride 作为依赖

  return (
    <div>
      <h2>{`${stride} stride`}</h2>
      <div className="display" ref={displayRef} />
      <div ref={anchorRef} />
      <div
        ref={divRef}
        contentEditable
        // onInput={handleInput}
        suppressContentEditableWarning
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          minHeight: '100px',
          outline: 'none',
        }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        // biome-ignore lint/security/noDangerouslySetInnerHtmlWithChildren: <explanation>
        dangerouslySetInnerHTML={{ __html: initialContent }}
      >
      </div>
    </div>
  );
};
