'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  FileText, Video, File as FileIcon, Image as ImageIcon, Link as LinkIcon, 
  ExternalLink, Download, Loader2, X, AlertTriangle, Copy, CheckCircle2, ChevronLeft, ChevronRight, Share2,
  Lock, Eye, EyeOff
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SharedItem, ItemType, ItemFileAttachment } from '@/types';
import { format } from 'date-fns';

export default function PublicSingleItemPage() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<SharedItem | null>(null);
  const [collection, setCollection] = useState<{ id: string; name: string; is_private: boolean; pin?: string | null } | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState(false);
  
  // Gallery & Preview
  const [previewFiles, setPreviewFiles] = useState<{ url: string; name: string; type: ItemType }[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Toast
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('Copied');

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const parseFileAttachments = (rawContent: string, fallbackUrl?: string, fallbackName?: string, fallbackType: ItemType = 'file'): ItemFileAttachment[] => {
    try {
      if (rawContent && rawContent.startsWith('{') && rawContent.endsWith('}')) {
        const parsed = JSON.parse(rawContent);
        if (parsed && parsed.__sharey_multi__ && Array.isArray(parsed.files)) {
          return parsed.files;
        }
      }
    } catch (e) {
      // not multi json
    }

    if (fallbackUrl) {
      return [{
        name: fallbackName || 'attachment',
        url: fallbackUrl,
        type: fallbackType,
      }];
    }
    return [];
  };

  const getDisplayContent = (item: SharedItem): string => {
    if (item.content && item.content.startsWith('{') && item.content.endsWith('}')) {
      try {
        const parsed = JSON.parse(item.content);
        if (parsed && parsed.__sharey_multi__) {
          return parsed.text || '';
        }
      } catch (e) {
        // fallback
      }
    }
    return item.content || '';
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline break-all">
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderEmbed = (url: string) => {
    try {
      const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
      if (isYoutube) {
        const videoId = url.includes('youtube.com') ? new URL(url).searchParams.get('v') : url.split('/').pop()?.split('?')[0];
        if (videoId) {
          return (
            <div className="mt-3 relative w-full pt-[56.25%] rounded-xl overflow-hidden shadow-sm">
              <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
            </div>
          );
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const getIconForType = (type: ItemType) => {
    switch(type) {
      case 'link': return <LinkIcon className="w-4 h-4 text-blue-500" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-green-500" />;
      case 'video': return <Video className="w-4 h-4 text-purple-500" />;
      case 'file': return <FileText className="w-4 h-4 text-orange-500" />;
      default: return <FileIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shared_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setError('Item not found or has been removed');
        return;
      }

      const files = parseFileAttachments(data.content, data.file_url, data.file_name, data.type as ItemType);

      setItem({
        id: data.id,
        type: data.type as ItemType,
        title: data.title,
        content: data.content,
        fileName: data.file_name,
        fileSize: data.file_size,
        fileUrl: data.file_url,
        fileItems: files,
        collectionId: data.collection_id,
        createdAt: new Date(data.created_at)
      });

      if (data.collection_id) {
        const { data: colData } = await supabase
          .from('collections')
          .select('id, name, is_private, pin')
          .eq('id', data.collection_id)
          .single();

        if (colData) {
          setCollection(colData);
          if (colData.is_private && colData.pin) {
            setIsUnlocked(false);
          }
        }
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Could not load item');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = () => {
    if (collection?.pin === pinInput) {
      setIsUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const openGalleryAt = (files: { url: string; name: string; type: ItemType }[], index: number) => {
    setPreviewFiles(files);
    setPreviewIndex(index);
    setShowPreviewModal(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Oops!</h2>
          <p className="text-gray-600 dark:text-gray-400">{error || 'Item not found'}</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked && collection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">{collection.name}</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">This item belongs to a private collection. Please enter the PIN to view it.</p>
          
          <div className="relative mb-6">
            <input 
              type={showPin ? "text" : "password"}
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value);
                setPinError(false);
              }}
              placeholder="Enter PIN"
              className={`w-full bg-gray-50 dark:bg-gray-800 border ${pinError ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-indigo-500'} rounded-xl px-4 py-3.5 outline-none text-gray-900 dark:text-gray-100 pr-12 transition-colors`}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            {pinError && <p className="text-red-500 text-sm mt-2 absolute">Incorrect PIN. Try again.</p>}
          </div>

          <button 
            onClick={handleUnlock}
            disabled={!pinInput.trim()}
            className="w-full px-4 py-3.5 mt-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm hover:shadow hover:-translate-y-0.5 disabled:opacity-50"
          >
            Unlock Item
          </button>
        </div>
      </div>
    );
  }

  const files = item.fileItems || [];
  const textContent = getDisplayContent(item);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-4 sm:p-8">
      {/* Toast */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-[80] animate-in fade-in slide-in-from-top-5">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="font-medium text-sm">{toastMsg}</span>
        </div>
      )}

      <div className="max-w-2xl mx-auto pt-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Sharey" className="w-9 h-9" />
            <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-gray-100">Sharey</span>
          </div>
          <button 
            onClick={() => handleCopy(window.location.href)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Share2 className="w-4 h-4 text-indigo-500" /> Share
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8 shadow-sm min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg shrink-0">
                {getIconForType(item.type)}
              </div>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md uppercase tracking-wider">
                {item.type}
              </span>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
              {format(item.createdAt, 'MMM d · h:mm a')}
            </div>
          </div>

          {/* Title */}
          {item.title && (
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 break-words">
              {item.title}
            </h2>
          )}

          {/* Text or Link content */}
          {textContent && (
            item.type === 'link' ? (
              <div className="min-w-0 mb-4">
                <a 
                  href={textContent} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline break-all inline leading-relaxed text-base sm:text-lg"
                >
                  <span>{textContent}</span>
                  <ExternalLink className="w-4 h-4 inline ml-1.5 align-middle shrink-0" />
                </a>
                {renderEmbed(textContent)}
              </div>
            ) : (
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words text-base leading-relaxed mb-4">
                {renderTextWithLinks(textContent)}
              </p>
            )
          )}

          {/* Attached Files & Gallery */}
          {files.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* Unified Visual Media Grid (Images and Videos Side-by-Side) */}
              {(() => {
                const visualFiles = files.filter(f => f.type === 'image' || f.type === 'video');
                if (visualFiles.length === 0) return null;

                const gridColsClass = visualFiles.length === 1 
                  ? 'grid-cols-1' 
                  : visualFiles.length === 2 
                    ? 'grid-cols-2' 
                    : 'grid-cols-2 sm:grid-cols-3';

                return (
                  <div className={`grid gap-2.5 ${gridColsClass}`}>
                    {visualFiles.map((f, vIdx) => {
                      const originalIdx = files.findIndex(file => file.url === f.url);

                      return (
                        <div 
                          key={vIdx} 
                          onClick={() => openGalleryAt(files, originalIdx)}
                          className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 cursor-pointer bg-gray-50 dark:bg-gray-950 aspect-video group shadow-sm"
                        >
                          {f.type === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={f.url} 
                              alt={f.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                              loading="lazy" 
                            />
                          ) : (
                            <div className="w-full h-full bg-black relative flex items-center justify-center">
                              <video src={f.url} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-white/80 dark:bg-black/80 flex items-center justify-center text-gray-900 dark:text-white shadow-md">
                                  <Video className="w-5 h-5" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Document / generic files list */}
              {files.filter(f => f.type === 'file').map((f, docIdx) => (
                <div 
                  key={docIdx}
                  className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-2xl"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-orange-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-900 dark:text-gray-100 font-medium truncate text-sm">{f.name}</p>
                      {f.size && <p className="text-xs text-gray-500 dark:text-gray-400">{f.size}</p>}
                    </div>
                  </div>
                  <a 
                    href={`${f.url}?download=${encodeURIComponent(f.name)}`} 
                    download={f.name} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold transition-colors shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2 pt-6 mt-4 border-t border-gray-100 dark:border-gray-800">
            {textContent && (
              <button 
                onClick={() => handleCopy(textContent)} 
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Copy className="w-4 h-4" /> Copy Text
              </button>
            )}
            <button 
              onClick={() => handleCopy(window.location.href)} 
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-sm font-medium text-indigo-700 dark:text-indigo-300 transition-colors"
            >
              <Share2 className="w-4 h-4" /> Share Link
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal with < and > Gallery Navigation */}
      {showPreviewModal && previewFiles.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowPreviewModal(false)}></div>
          
          {/* Previous Button */}
          {previewFiles.length > 1 && (
            <button 
              onClick={() => setPreviewIndex((previewIndex - 1 + previewFiles.length) % previewFiles.length)}
              className="absolute left-3 sm:left-6 z-20 p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all hover:scale-105"
              title="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next Button */}
          {previewFiles.length > 1 && (
            <button 
              onClick={() => setPreviewIndex((previewIndex + 1) % previewFiles.length)}
              className="absolute right-3 sm:right-6 z-20 p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all hover:scale-105"
              title="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div className="bg-white dark:bg-gray-900 w-full h-full sm:w-[92vw] sm:h-[92vh] sm:rounded-3xl shadow-2xl relative z-10 border-0 sm:border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {previewFiles[previewIndex]?.name || 'Preview'}
                </h3>
                {previewFiles.length > 1 && (
                  <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full font-medium shrink-0">
                    {previewIndex + 1} / {previewFiles.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a 
                  href={`${previewFiles[previewIndex]?.url}?download=${encodeURIComponent(previewFiles[previewIndex]?.name || 'download')}`} 
                  download={previewFiles[previewIndex]?.name} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button 
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black p-4 flex items-center justify-center">
              {previewFiles[previewIndex]?.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={previewFiles[previewIndex]?.url} 
                  alt={previewFiles[previewIndex]?.name || ''} 
                  className="max-w-full max-h-full object-contain rounded-lg" 
                />
              ) : previewFiles[previewIndex]?.type === 'video' ? (
                <video src={previewFiles[previewIndex]?.url} controls playsInline className="max-w-full max-h-full rounded-lg" />
              ) : (
                <iframe src={previewFiles[previewIndex]?.url} className="w-full h-full min-h-[60vh] bg-white rounded-lg border border-gray-200 dark:border-gray-800" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
