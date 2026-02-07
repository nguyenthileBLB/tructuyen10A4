import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Superscript, Subscript, Image as ImageIcon, Type, Divide, X } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const COMMON_SYMBOLS = [
  'π', 'Δ', 'Ω', '∑', '∞', '≈', '≠', '≤', '≥', '±', '÷', '×', '°', 'α', 'β', 'γ', 'θ', 'λ', 'μ', '√', '∫', '→', '←', '⇒', '⇔', '∈', '∉', '⊂', '⊃'
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showSymbols, setShowSymbols] = useState(false);

  // Sync content when value changes externally (only if not focused to avoid cursor jumping)
  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    // If value is empty, clear editor
    if (!value && editorRef.current) {
        editorRef.current.innerHTML = '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    handleInput();
    editorRef.current?.focus();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgHtml = `<img src="${e.target?.result}" class="max-w-full h-auto rounded-lg my-2 border border-slate-200" style="max-height: 300px;" />`;
        execCommand('insertHTML', imgHtml);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Handle image paste
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imgHtml = `<img src="${event.target?.result}" class="max-w-full h-auto rounded-lg my-2 border border-slate-200" style="max-height: 300px;" />`;
                execCommand('insertHTML', imgHtml);
            };
            reader.readAsDataURL(blob);
        }
        return;
      }
    }
  };

  const insertSymbol = (symbol: string) => {
      execCommand('insertText', symbol);
      setShowSymbols(false);
  }

  return (
    <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
      {/* Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap gap-1 items-center">
        <button tabIndex={-1} onClick={() => execCommand('bold')} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all" title="In đậm (Bold)">
          <Bold className="w-4 h-4" />
        </button>
        <button tabIndex={-1} onClick={() => execCommand('italic')} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all" title="In nghiêng (Italic)">
          <Italic className="w-4 h-4" />
        </button>
        <button tabIndex={-1} onClick={() => execCommand('underline')} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all" title="Gạch chân (Underline)">
          <Underline className="w-4 h-4" />
        </button>
        
        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        <button tabIndex={-1} onClick={() => execCommand('superscript')} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all" title="Chỉ số trên (Superscript)">
          <Superscript className="w-4 h-4" />
        </button>
        <button tabIndex={-1} onClick={() => execCommand('subscript')} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all" title="Chỉ số dưới (Subscript)">
          <Subscript className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        
        {/* Symbol Picker */}
        <div className="relative">
            <button tabIndex={-1} onClick={() => setShowSymbols(!showSymbols)} className={`p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all ${showSymbols ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600'}`} title="Ký tự đặc biệt (Unicode)">
                <Divide className="w-4 h-4" />
            </button>
            {showSymbols && (
                <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-xl shadow-xl border border-slate-200 z-50 w-64 flex flex-wrap gap-1 animate-fade-in">
                    <div className="flex justify-between w-full items-center mb-2 px-1">
                        <span className="text-xs font-bold text-slate-500">Chọn ký tự</span>
                        <button onClick={() => setShowSymbols(false)}><X className="w-3 h-3 text-slate-400 hover:text-rose-500"/></button>
                    </div>
                    {COMMON_SYMBOLS.map(sym => (
                        <button 
                            key={sym} 
                            onClick={() => insertSymbol(sym)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-700 font-serif text-sm transition-colors border border-transparent hover:border-indigo-100"
                        >
                            {sym}
                        </button>
                    ))}
                </div>
            )}
        </div>

        <div className="w-px h-6 bg-slate-300 mx-1"></div>

        <label className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-600 cursor-pointer transition-all" title="Chèn ảnh">
          <ImageIcon className="w-4 h-4" />
          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
        </label>
        
        <button tabIndex={-1} onClick={() => execCommand('removeFormat')} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-rose-500 ml-auto" title="Xoá định dạng">
          <Type className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="p-4 min-h-[120px] outline-none text-slate-700 font-medium text-lg prose max-w-none"
        data-placeholder={placeholder}
        style={{ whiteSpace: 'pre-wrap' }}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;