'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  FileText, Video, File as FileIcon, Image as ImageIcon, Link as LinkIcon, 
  ExternalLink, Download, Lock, Loader2, X, AlertTriangle, Eye, EyeOff,
  ChevronLeft, ChevronRight, Share2, Copy
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SharedItem, ItemType, ItemFileAttachment } from '@/types';
import { format } from 'date-fns';

export default function PublicCollectionPage() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collection, setCollection] = useState<any>(null);
  const [items, setItems] = useState<SharedItem[]>([]);
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [isUnlockedBlinking, setIsUnlockedBlinking] = useState(false);
  
  // Gallery Navigation Modal
  const [previewFiles, setPreviewFiles] = useState<{ url: string; name: string; type: ItemType }[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const parseFileAttachments = (rawContent: string, fallbackUrl?: string, fallbackName?: string, fallbackType: ItemType = 'file'): ItemFileAttachment[] => {
    try {
      if (rawContent && rawContent.startsWith('{') && rawContent.endsWith('}')) {
        const parsed = JSON.parse(rawContent);
        if (parsed && parsed.__sharey_multi__ && Array.isArray(parsed.files)) {
          return parsed.files;
        }
      }
    } catch (e) {}

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
      } catch (e) {}
    }
    return item.content || '';
  };

  const openGalleryAt = (files: { url: string; name: string; type: ItemType }[], index: number) => {
    setPreviewFiles(files);
    setPreviewIndex(index);
    setShowPreviewModal(true);
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
  useEffect(() => {
    fetchCollection();
  }, [id]);

  const fetchCollection = async () => {
    try {
      const { data, error } = await supabase.rpc('get_collection_data', { p_collection_id: id });
      
      if (error) throw error;
      if (!data) {
        setError('Collection not found');
        return;
      }
      
      setCollection(data.collection);
      
      // Parse items safely
      const parsedItems = Array.isArray(data.items) ? data.items : [];
      const formattedItems = parsedItems.map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type as ItemType,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        fileName: item.file_name,
        fileUrl: item.file_url,
        fileSize: item.file_size,
        mimeType: item.mime_type,
        fileItems: parseFileAttachments(item.content, item.file_url, item.file_name, item.type as ItemType),
        collectionId: item.collection_id
      })).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setItems(formattedItems);
      
      if (!data.collection.is_private || !data.collection.pin) {
        setIsUnlocked(true);
      }
      
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Could not load collection');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = () => {
    if (collection?.pin === pinInput) {
      setIsUnlocked(true);
      setPinError(false);
      setIsUnlockedBlinking(true);
      setTimeout(() => setIsUnlockedBlinking(false), 1500);
    } else {
      setPinError(true);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Oops!</h2>
          <p className="text-gray-600 dark:text-gray-400">{error || 'Collection not found'}</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">{collection.name}</h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">This collection is private. Please enter the PIN to view it.</p>
          
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
            Unlock Collection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{collection.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </header>

        <div className={`space-y-4 ${isUnlockedBlinking ? 'animate-border-blink' : ''}`}>
          {items.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400">This collection is empty.</p>
            </div>
          ) : (
            items.map(item => {
              const cardFiles = item.fileItems && item.fileItems.length > 0 
                ? item.fileItems 
                : (item.fileUrl ? [{ name: item.fileName || 'file', size: item.fileSize, url: item.fileUrl, type: item.type }] : []);
              const textContent = getDisplayContent(item);

              return (
              <div 
                key={item.id} 
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm transition-all min-w-0"
              >
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg shrink-0">
                      {getIconForType(item.type)}
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md uppercase tracking-wider shrink-0">
                      {item.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap shrink-0 pt-1">
                    {format(item.createdAt, 'MMM d · h:mm a')}
                  </div>
                </div>

                <div className="pl-10 mb-4 min-w-0">
                  {item.title && (
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base mb-1 break-words">{item.title}</h4>
                  )}
                  {textContent && (
                    item.type === 'link' ? (
                      <div className="min-w-0 mb-2">
                        <a 
                          href={textContent} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline break-all inline leading-relaxed"
                        >
                          <span>{textContent}</span>
                          <ExternalLink className="w-3.5 h-3.5 inline ml-1.5 align-middle shrink-0" />
                        </a>
                        {renderEmbed(textContent)}
                      </div>
                    ) : (
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words text-[15px] leading-relaxed mb-2">
                        {renderTextWithLinks(textContent)}
                      </p>
                    )
                  )}

                  {/* Attached Files & Gallery */}
                  {cardFiles.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {/* Unified Visual Media Grid (Images and Videos Side-by-Side) */}
                      {(() => {
                        const visualFiles = cardFiles.filter(f => f.type === 'image' || f.type === 'video');
                        if (visualFiles.length === 0) return null;

                        const maxVisible = 4;
                        const visibleFiles = visualFiles.slice(0, maxVisible);
                        const remainingCount = visualFiles.length - maxVisible;

                        const gridColsClass = visualFiles.length === 1 
                          ? 'grid-cols-1' 
                          : visualFiles.length === 2 
                            ? 'grid-cols-2' 
                            : 'grid-cols-2 sm:grid-cols-3';

                        return (
                          <div className={`grid gap-2 ${gridColsClass}`}>
                            {visibleFiles.map((f, vIdx) => {
                              const originalIdx = cardFiles.findIndex(file => file.url === f.url);
                              const isLast = vIdx === maxVisible - 1 && remainingCount > 0;

                              return (
                                <div 
                                  key={vIdx} 
                                  onClick={() => openGalleryAt(cardFiles, originalIdx)}
                                  className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 cursor-pointer bg-gray-50 dark:bg-gray-950 aspect-video group"
                                >
                                  {f.type === 'image' ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img 
                                      src={f.url} 
                                      alt={f.name} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
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

                                  {isLast && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-xs">
                                      +{remainingCount + 1}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Document / Other files */}
                      {cardFiles.filter(f => f.type === 'file').map((f, docIdx) => (
                        <div 
                          key={docIdx}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                            <div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-orange-500">
                              <FileText className="w-4 h-4" />
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
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pl-10 flex flex-wrap gap-2">
                  {cardFiles.length === 1 && (
                    <a href={`${cardFiles[0].url}?download=${encodeURIComponent(cardFiles[0].name)}`} download={cardFiles[0].name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  )}
                </div>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* Gallery & Preview Modal with < and > Navigation */}
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
