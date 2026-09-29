'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  FileText, Video, File as FileIcon, Image as ImageIcon, Link as LinkIcon, 
  ExternalLink, Download, Lock, Loader2, X, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { SharedItem, ItemType } from '@/types';
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
  
  const [previewItem, setPreviewItem] = useState<SharedItem | null>(null);

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
        content: item.content,
        type: item.type as ItemType,
        userId: item.user_id,
        createdAt: new Date(item.created_at),
        fileName: item.file_name,
        fileUrl: item.file_url,
        fileSize: item.file_size,
        mimeType: item.mime_type,
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
            items.map(item => (
              <div 
                key={item.id} 
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg">
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

                <div className="pl-10 mb-4">
                  {item.type === 'link' ? (
                    <div>
                      <a href={item.content} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline break-words flex items-center gap-1.5 mb-2">
                        {item.content}
                        <ExternalLink className="w-3.5 h-3.5 inline" />
                      </a>
                      {renderEmbed(item.content)}
                    </div>
                  ) : item.type === 'text' ? (
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{item.content}</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 -ml-2 rounded-xl transition-colors"
                        onClick={() => {
                          if (item.fileUrl && item.type !== 'video') {
                            setPreviewItem(item);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-900 dark:text-gray-100 font-medium truncate text-[15px]">{item.fileName || item.content}</p>
                          {item.fileSize && <p className="text-xs text-gray-500 dark:text-gray-400">{item.fileSize}</p>}
                        </div>
                      </div>

                      {item.fileUrl && item.type === 'image' && (
                         <div 
                           className="mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 cursor-pointer"
                           onClick={() => setPreviewItem(item)}
                         >
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img 
                            src={item.fileUrl} 
                            alt={item.fileName || 'Image'} 
                            className="w-full h-auto max-h-[500px] object-contain bg-gray-50 dark:bg-gray-950 transition-transform hover:scale-[1.02]" 
                            loading="lazy" 
                           />
                         </div>
                      )}
                      
                      {item.fileUrl && item.type === 'video' && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black aspect-video flex">
                          <video 
                            src={item.fileUrl} 
                            controls 
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {item.fileUrl && (
                  <div className="pl-10">
                    <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-colors">
                      <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Download</span>
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {previewItem && previewItem.fileUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewItem(null)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl relative z-10 border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{previewItem.fileName || 'Preview'}</h3>
              <div className="flex items-center gap-2">
                <a 
                  href={previewItem.fileUrl} 
                  download={previewItem.fileName} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button 
                  onClick={() => setPreviewItem(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black p-4 flex items-center justify-center">
              {previewItem.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewItem.fileUrl} alt={previewItem.fileName || ''} className="max-w-full max-h-full object-contain" />
              ) : previewItem.type === 'video' ? (
                <video src={previewItem.fileUrl} controls playsInline className="max-w-full max-h-full" />
              ) : (
                <iframe src={previewItem.fileUrl} className="w-full h-full min-h-[60vh] bg-white rounded-lg border border-gray-200 dark:border-gray-800" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
