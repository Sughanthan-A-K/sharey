'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { 
  Paperclip, Send, Search, Image as ImageIcon, Link as LinkIcon, 
  FileText, Video, File as FileIcon, Copy, Trash2, X, Download, 
  CheckCircle2, ExternalLink, LogOut, AlertTriangle, Moon, Sun, Loader2, Edit2,
  Folder, Plus, MoreVertical, MoreHorizontal
} from 'lucide-react';
import { SharedItem, ItemType, Collection } from '@/types';
import { createClient } from '@/utils/supabase/client';

function InstagramPlayer({ url }: { url: string }) {
  const [videoData, setVideoData] = useState<{ url: string, thumb: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/ig?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(data => {
        if (data.videoUrl) {
          setVideoData({ url: data.videoUrl, thumb: data.thumbnail });
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [url]);

  if (error || !videoData) {
    // Fallback to official embed if API fails or while loading
    let embedUrl = url.split('?')[0]; 
    if (!embedUrl.endsWith('/')) embedUrl += '/';
    embedUrl += 'embed';
    
    return (
      <div className="mt-3 w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm relative">
        {!error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 z-10">
             <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
        <iframe 
          src={embedUrl}
          className="w-full relative z-0"
          height="480"
          style={{ border: 'none' }}
          scrolling="no"
          allow="encrypted-media"
        ></iframe>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-black border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-center">
       <video 
         src={videoData.url} 
         poster={videoData.thumb}
         controls 
         className="w-full h-auto max-h-[600px]"
         playsInline
       />
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('Saved');
  
  // Modals
  const [deleteTarget, setDeleteTarget] = useState<string | 'bulk' | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editTarget, setEditTarget] = useState<SharedItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editAttachedFiles, setEditAttachedFiles] = useState<File[]>([]);
  const [editFileRemoved, setEditFileRemoved] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Collections State
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionInputValue, setCollectionInputValue] = useState('');
  const [editCollectionTarget, setEditCollectionTarget] = useState<Collection | null>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<string | null>(null);
  const [selectedCollectionForUpload, setSelectedCollectionForUpload] = useState<string | null>(null);
  const [editItemCollectionId, setEditItemCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const handleSaveEdit = async () => {
    if (!editTarget || isSavingEdit) return;
    
    setIsSavingEdit(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsSavingEdit(false);
      return;
    }

    try {
      let isFirst = true;

      const processPayload = async (payload: any) => {
        const finalPayload = { ...payload, collection_id: editItemCollectionId };
        if (isFirst) {
          const { error } = await supabase.from('shared_items').update(finalPayload).eq('id', editTarget.id);
          if (error) throw error;
          isFirst = false;
        } else {
          const { error } = await supabase.from('shared_items').insert({ ...finalPayload, user_id: user.id });
          if (error) throw error;
        }
      };

      // 1. Process Text
      if (editValue.trim()) {
        let finalType = 'text';
        if (editValue.trim().match(/^(https?:\/\/[^\s]+)$/g)) {
          finalType = 'link';
        }
        await processPayload({
          content: editValue.trim(),
          type: finalType,
          file_name: null,
          file_url: null,
          file_size: null,
          mime_type: null
        });
      }

      // 2. Process existing file (if not removed)
      if (editTarget.type !== 'text' && editTarget.type !== 'link' && !editFileRemoved) {
        if (isFirst) {
           // We update the existing item to apply the potential new collection_id
           await processPayload({
             content: editTarget.fileName,
             type: editTarget.type,
             file_name: editTarget.fileName,
             file_url: editTarget.fileUrl,
             file_size: editTarget.fileSize,
           });
        } else {
           // Text took the first slot, so insert the existing file as a new item
           await processPayload({
             content: editTarget.fileName,
             type: editTarget.type,
             file_name: editTarget.fileName,
             file_url: editTarget.fileUrl,
             file_size: editTarget.fileSize,
           });
        }
      }

      // 3. Process new attached files
      for (const file of editAttachedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('sharey_files').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('sharey_files').getPublicUrl(filePath);

        await processPayload({
          file_name: file.name,
          content: file.name,
          file_url: publicUrl,
          file_size: formatFileSize(file.size),
          type: getFileType(file),
          mime_type: file.type
        });
      }

      // Instead of manual optimistic UI for splits, just re-fetch to ensure correctness
      await fetchItems();

      setEditTarget(null);
      setEditValue('');
      setEditAttachedFiles([]);
      setEditFileRemoved(false);
      
      setToastMsg("Updated successfully");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      console.error("Upload error:", err);
      setToastMsg(err.message || "Failed to update file. It might be too large.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchItems();
  }, []);

  useEffect(() => {
    if (editTarget || deleteTarget || showLogoutConfirm || showCollectionModal || deleteCollectionTarget) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [editTarget, deleteTarget, showLogoutConfirm, showCollectionModal, deleteCollectionTarget]);

  const fetchItems = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Fetch collections
    const { data: collectionsData } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    if (collectionsData) {
      setCollections(collectionsData.map(c => ({
        id: c.id,
        name: c.name,
        createdAt: new Date(c.created_at)
      })));
    }

    const { data, error } = await supabase
      .from('shared_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data.map(d => ({
        id: d.id,
        type: d.type as ItemType,
        content: d.content,
        fileName: d.file_name,
        fileSize: d.file_size,
        fileUrl: d.file_url,
        collectionId: d.collection_id,
        createdAt: new Date(d.created_at)
      })));
    }
    setLoading(false);
  };

  const handleSaveCollection = async () => {
    if (!collectionInputValue.trim()) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editCollectionTarget) {
      const { error } = await supabase
        .from('collections')
        .update({ name: collectionInputValue.trim() })
        .eq('id', editCollectionTarget.id);
      
      if (error) {
        showNotification(error.message);
      } else {
        showNotification('Collection updated');
        setShowCollectionModal(false);
        fetchItems();
      }
    } else {
      const { error } = await supabase
        .from('collections')
        .insert({ user_id: user.id, name: collectionInputValue.trim() });
      
      if (error) {
        showNotification(error.message);
      } else {
        showNotification('Collection created');
        setShowCollectionModal(false);
        fetchItems();
      }
    }
  };

  const handleDeleteCollection = async () => {
    if (!deleteCollectionTarget) return;
    
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', deleteCollectionTarget);
      
    if (error) {
      showNotification(error.message);
    } else {
      showNotification('Collection deleted');
      if (activeCollection === deleteCollectionTarget) {
        setActiveCollection(null);
      }
      setDeleteCollectionTarget(null);
      fetchItems();
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId);
  };

  const handleDragOver = (e: React.DragEvent, collectionId: string | null) => {
    e.preventDefault();
    if (dragOverCollectionId !== collectionId) {
      setDragOverCollectionId(collectionId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCollectionId(null);
  };

  const handleDropToCollection = async (e: React.DragEvent, targetCollectionId: string | null) => {
    e.preventDefault();
    setDragOverCollectionId(null);
    
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId) return;

    const itemToMove = items.find(i => i.id === itemId);
    if (!itemToMove || itemToMove.collectionId === targetCollectionId) return;

    const previousItems = [...items];
    
    // Optimistic update
    setItems(items.map(item => 
      item.id === itemId ? { ...item, collectionId: targetCollectionId } : item
    ));

    const { error } = await supabase
      .from('shared_items')
      .update({ collection_id: targetCollectionId })
      .eq('id', itemId);

    if (error) {
      setItems(previousItems);
      showNotification("Failed to move item: " + error.message);
    } else {
      const colName = targetCollectionId ? collections.find(c => c.id === targetCollectionId)?.name : 'All Items';
      showNotification(`Moved to ${colName}`);
    }
  };

  const executeLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const detectType = (text: string): ItemType => {
    if (text.trim().startsWith('http://') || text.trim().startsWith('https://')) {
      return 'link';
    }
    return 'text';
  };

  const getFileType = (file: File): ItemType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const showNotification = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleSharey = async () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || uploading) return;

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }

    try {
      const newItems: SharedItem[] = [];

      // 1. Upload files
      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('sharey_files')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('sharey_files')
            .getPublicUrl(filePath);

          const { data, error: dbError } = await supabase
            .from('shared_items')
            .insert({
              user_id: user.id,
              type: getFileType(file),
              content: file.name,
              file_name: file.name,
              file_size: formatFileSize(file.size),
              file_url: publicUrl,
              mime_type: file.type,
              collection_id: selectedCollectionForUpload
            })
            .select()
            .single();

          if (dbError) throw dbError;
          
          newItems.push({
            id: data.id,
            type: data.type as ItemType,
            content: data.content,
            fileName: data.file_name,
            fileSize: data.file_size,
            fileUrl: data.file_url,
            createdAt: new Date(data.created_at)
          });
        }
      }

      // 2. Save text/link
      if (inputValue.trim()) {
        const { data, error } = await supabase
          .from('shared_items')
          .insert({
            user_id: user.id,
            type: detectType(inputValue),
            content: inputValue,
            collection_id: selectedCollectionForUpload
          })
          .select()
          .single();

        if (error) throw error;

        newItems.push({
          id: data.id,
          type: data.type as ItemType,
          content: data.content,
          createdAt: new Date(data.created_at)
        });
      }

      setItems([...newItems, ...items]);
      setInputValue('');
      setAttachedFiles([]);
      showNotification('Saved');
    } catch (err: any) {
      console.error("Upload error:", err);
      showNotification(err.message || "Failed to upload file. It might be too large.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFilesArray = Array.from(e.target.files);
      let dbDuplicateCount = 0;
      let limitHit = false;
      let sizeLimitHit = false;
      
      // Calculate first
      const validFiles: File[] = [];
      newFilesArray.forEach(file => {
        if (file.size > 50 * 1024 * 1024) {
          sizeLimitHit = true;
          return;
        }

        const formattedSize = formatFileSize(file.size);
        const inDB = items.some(item => item.fileName === file.name && item.fileSize === formattedSize);
        
        if (inDB) {
          dbDuplicateCount++;
        } else {
          validFiles.push(file);
        }
      });

      // Then update state
      setAttachedFiles(prev => {
        const combined = [...prev];
        validFiles.forEach(file => {
          const inPending = combined.some(f => f.name === file.name && f.size === file.size);
          if (!inPending) {
            if (combined.length < 10) {
              combined.push(file);
            } else {
              limitHit = true;
            }
          }
        });
        return combined;
      });

      e.target.value = '';

      // We can use setTimeout to ensure React processes the state first, though not strictly required, it's safer for toasts
      setTimeout(() => {
        if (sizeLimitHit) {
          showNotification("Files over 50MB are not allowed");
        } else if (dbDuplicateCount > 0) {
          showNotification(`Skipped ${dbDuplicateCount} file(s) already saved`);
        } else if (limitHit) {
          showNotification("Maximum 10 files allowed");
        }
      }, 0);
    }
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(files => files.filter((_, i) => i !== index));
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget === 'bulk') {
      const idsToDelete = Array.from(selectedItems);
      const itemsToDelete = items.filter(i => selectedItems.has(i.id) && i.fileUrl);
      
      for (const item of itemsToDelete) {
         const urlObj = new URL(item.fileUrl!);
         const parts = urlObj.pathname.split('/sharey_files/');
         if (parts.length > 1) {
           await supabase.storage.from('sharey_files').remove([parts[1]]);
         }
      }
      await supabase.from('shared_items').delete().in('id', idsToDelete);
      setItems(items.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
    } else {
      const id = deleteTarget;
      const itemToDelete = items.find(i => i.id === id);
      if (itemToDelete?.fileUrl) {
        const urlObj = new URL(itemToDelete.fileUrl);
        const parts = urlObj.pathname.split('/sharey_files/');
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabase.storage.from('sharey_files').remove([filePath]);
        }
      }
      await supabase.from('shared_items').delete().eq('id', id);
      setItems(items.filter(item => item.id !== id));
      if (selectedItems.has(id)) {
        const newSet = new Set(selectedItems);
        newSet.delete(id);
        setSelectedItems(newSet);
      }
    }

    setDeleteTarget(null);
    showNotification('Deleted');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    showNotification('Copied');
  };

  const copySelected = () => {
    const contentToCopy = items
      .filter(item => selectedItems.has(item.id))
      .map(item => item.content)
      .join('\n\n');
    navigator.clipboard.writeText(contentToCopy);
    showNotification('Copied');
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
    const matchesSearch = item.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.fileName && item.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCollection = activeCollection ? item.collectionId === activeCollection : true;
    return matchesFilter && matchesSearch && matchesCollection;
  });

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
      const parsedUrl = new URL(url);
      
      // YouTube
      if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        let videoId = '';
        if (parsedUrl.hostname.includes('youtu.be')) {
          videoId = parsedUrl.pathname.substring(1);
        } else {
          videoId = parsedUrl.searchParams.get('v') || '';
        }
        if (videoId) {
          return (
            <div className="mt-3 aspect-video w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
              <iframe 
                className="w-full h-full" 
                src={`https://www.youtube.com/embed/${videoId}`} 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          );
        }
      }
      
      // Instagram
      if (parsedUrl.hostname.includes('instagram.com')) {
        return <InstagramPlayer url={url} />;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  const hasChanges = () => {
    if (!editTarget) return false;
    
    // 1. Text changed?
    const originalText = (editTarget.type === 'text' || editTarget.type === 'link') ? editTarget.content : '';
    const textChanged = editValue.trim() !== originalText;
    
    // 2. Original file removed?
    const fileRemoved = editFileRemoved;
    
    // 3. New files attached?
    const newFilesAdded = editAttachedFiles.length > 0;
    
    // 4. Collection changed?
    const collectionChanged = editItemCollectionId !== (editTarget.collectionId || null);

    return textChanged || fileRemoved || newFilesAdded || collectionChanged;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans pb-24 transition-colors">
      
      {/* STICKY TOP CONTAINER */}
      <div className="bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 transition-colors shadow-sm">
        
        {/* Header */}
        <header className="py-4 px-4 md:px-8 2xl:px-12 flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Sharey Logo" className="w-10 h-10 drop-shadow-sm" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Sharey</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Save it now. Get it anywhere.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
      </div>

      {/* Main Layout Container */}
      <div className="w-full px-4 md:px-8 2xl:px-12 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Left Column: Composer (Sticky on Desktop) */}
        <div className="lg:col-span-3 lg:sticky lg:top-28 order-1">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-all focus-within:shadow-md focus-within:border-indigo-300 dark:focus-within:border-indigo-500">
            <textarea 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={uploading}
              placeholder="Paste a link, type something, or share anything..."
              className="w-full p-4 min-h-[100px] lg:min-h-[140px] resize-none outline-none text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base sm:text-lg bg-transparent disabled:opacity-50"
            />
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              multiple 
              className="hidden" 
            />

            {attachedFiles.length > 0 && (
              <div className="pl-5 pr-2 mr-2 pb-3 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg w-full">
                    <div className="p-1.5 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                      {getIconForType(getFileType(file))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                    </div>
                    {!uploading && (
                      <button onClick={() => removeAttachedFile(idx)} className="text-gray-400 hover:text-red-500 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center transition-colors">
              <div className="flex flex-wrap items-center gap-1">
                {collections.length > 0 && (
                  <select
                    value={selectedCollectionForUpload || ''}
                    onChange={(e) => setSelectedCollectionForUpload(e.target.value || null)}
                    disabled={uploading}
                    className="bg-transparent text-sm font-medium text-gray-600 dark:text-gray-400 outline-none border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 focus:border-indigo-400 dark:focus:border-indigo-500"
                  >
                    <option value="">No Collection</option>
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="hidden sm:inline">Attach</span>
                </button>
                {(attachedFiles.length > 0 || inputValue.trim().length > 0) && (
                  <button 
                    onClick={() => { setAttachedFiles([]); setInputValue(''); }}
                    disabled={uploading}
                    className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
              <button 
                onClick={handleSharey}
                disabled={(!inputValue.trim() && attachedFiles.length === 0) || uploading}
                className="flex items-center gap-2 bg-gray-900 dark:bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-gray-800 dark:hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all shadow-sm active:scale-95"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{uploading ? 'Uploading...' : 'SHAREY'}</span>
                {!uploading && <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Filters & Search (Sticky on Desktop) */}
        <div className="lg:col-span-3 lg:sticky lg:top-24 order-2 lg:order-3">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-9 pr-4 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/50 transition-all text-sm dark:text-gray-100 shadow-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {['all', 'text', 'link', 'image', 'video', 'file'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter as any)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border shadow-sm ${
                    activeFilter === filter 
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100' 
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Folder className="w-4 h-4 text-indigo-500" />
                Collections
              </h3>
              <button 
                onClick={() => {
                  setEditCollectionTarget(null);
                  setCollectionInputValue('');
                  setShowCollectionModal(true);
                }}
                className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                title="New Collection"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1">
              <button
                onClick={() => setActiveCollection(null)}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropToCollection(e, null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeCollection === null
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${dragOverCollectionId === null ? 'ring-2 ring-indigo-400 border-transparent bg-indigo-50 dark:bg-indigo-900/40' : ''}`}
              >
                All Items
              </button>
              
              {collections.map(col => (
                <div 
                  key={col.id} 
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropToCollection(e, col.id)}
                  className={`group w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    activeCollection === col.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  } ${dragOverCollectionId === col.id ? 'ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 border-transparent' : ''}`}
                  onClick={() => setActiveCollection(col.id)}
                >
                  <span className="truncate pr-2">{col.name}</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditCollectionTarget(col);
                        setCollectionInputValue(col.name);
                        setShowCollectionModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-indigo-600"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCollectionTarget(col.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              
              {collections.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-500">
                  No collections yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Feed (Scrollable) */}
        <div className="lg:col-span-6 space-y-4 order-3 lg:order-2">
          {loading ? (
            <div className="flex justify-center items-center py-12 gap-2 text-gray-400 font-medium">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading items...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 px-4 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Nothing saved yet</p>
              <p className="text-sm mt-1">Paste something or attach files to get started.</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div 
                key={item.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 sm:p-5 transition-all cursor-grab active:cursor-grabbing ${selectedItems.has(item.id) ? 'border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400 dark:ring-indigo-500 shadow-sm' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700'}`}
              >
                
                {/* Header with Icon */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      />
                    </label>
                    <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg">
                      {getIconForType(item.type)}
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md uppercase tracking-wider">
                      {item.type}
                    </span>
                    {item.collectionId && collections.find(c => c.id === item.collectionId) && (
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        {collections.find(c => c.id === item.collectionId)?.name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
                    {format(item.createdAt, 'MMM d · h:mm a')}
                  </div>
                </div>

                <div className="pl-8 mb-4">
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
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-900 dark:text-gray-100 font-medium truncate text-[15px]">{item.fileName || item.content}</p>
                          {item.fileSize && <p className="text-xs text-gray-500 dark:text-gray-400">{item.fileSize}</p>}
                        </div>
                      </div>

                      {/* Actual Image / Video */}
                      {item.fileUrl && item.type === 'image' && (
                         <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img 
                            src={item.fileUrl} 
                            alt={item.fileName || 'Image'} 
                            className="w-full h-auto max-h-[500px] object-contain bg-gray-50 dark:bg-gray-950" 
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

                <div className="pl-8 flex flex-wrap gap-2">
                  {(item.type === 'text' || item.type === 'link') ? (
                    <button onClick={() => handleCopy(item.content)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  ) : (
                    <>
                      {item.fileUrl && (
                        <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-colors">
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      )}
                      <button onClick={() => handleCopy(item.fileUrl || item.content)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
                        <LinkIcon className="w-3.5 h-3.5" /> Copy Link
                      </button>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => {
                      setEditTarget(item);
                      setEditValue(item.type === 'text' || item.type === 'link' ? item.content : '');
                      setEditAttachedFiles([]);
                      setEditFileRemoved(false);
                      setEditItemCollectionId(item.collectionId || null);
                    }} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => setDeleteTarget(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-4 z-40 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 dark:bg-black/10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {selectedItems.size}
            </span>
            <span className="text-sm font-medium">selected</span>
          </div>
          
          <div className="w-px h-6 bg-gray-700 dark:bg-gray-300"></div>
          
          <button onClick={copySelected} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 dark:hover:bg-black/5 rounded-lg text-sm font-medium transition-colors">
            <Copy className="w-4 h-4" /> Copy
          </button>
          <button onClick={() => setDeleteTarget('bulk')} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/20 dark:hover:bg-red-500/10 text-red-400 dark:text-red-600 rounded-lg text-sm font-medium transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          
          <div className="w-px h-6 bg-gray-700 dark:bg-gray-300"></div>
          
          <button onClick={() => setSelectedItems(new Set())} className="p-1 hover:bg-white/10 dark:hover:bg-black/5 rounded-full transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4 mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-2">Delete Item{deleteTarget === 'bulk' && 's'}?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              {deleteTarget === 'bulk' 
                ? `Are you sure you want to delete ${selectedItems.size} items? This cannot be undone.`
                : "Are you sure you want to delete this item? This action cannot be undone."}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-4 mx-auto">
              <LogOut className="w-6 h-6 text-gray-600 dark:text-gray-400 ml-1" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-2">Log out of Sharey?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              You will need to log in again to access your saved items on this device.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeLogout}
                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-medium rounded-xl transition-colors shadow-sm"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-2xl border border-gray-200 dark:border-gray-800 transition-colors w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center gap-2 mb-4 shrink-0 text-indigo-600 dark:text-indigo-400 font-bold">
              <Edit2 className="w-5 h-5" />
              <span>Edit Item</span>
            </div>
            
            {collections.length > 0 && (
              <div className="mb-4">
                <select
                  value={editItemCollectionId || ''}
                  onChange={(e) => setEditItemCollectionId(e.target.value || null)}
                  disabled={isSavingEdit}
                  className="w-full bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 outline-none border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:border-indigo-400 dark:focus:border-indigo-500"
                >
                  <option value="">No Collection</option>
                  {collections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Type a note or paste a link..."
                className="w-full bg-transparent resize-none outline-none min-h-[100px] text-gray-800 dark:text-gray-200 text-lg placeholder-gray-400 dark:placeholder-gray-500 mb-4"
                disabled={isSavingEdit}
              />

              {/* Existing File Preview */}
              {editTarget.type !== 'text' && editTarget.type !== 'link' && !editFileRemoved && (
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="relative group flex items-center gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl">
                    <div className="p-2 bg-white dark:bg-gray-900 rounded-lg text-indigo-600 dark:text-indigo-400">
                      {getIconForType(editTarget.type)}
                    </div>
                    <div className="flex flex-col pr-6">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                        {editTarget.fileName}
                      </span>
                      <span className="text-xs text-gray-500">{editTarget.fileSize}</span>
                    </div>
                    <button 
                      onClick={() => setEditFileRemoved(true)}
                      className="absolute -top-2 -right-2 bg-white dark:bg-gray-700 text-gray-500 hover:text-red-500 rounded-full p-1 shadow-md border border-gray-200 dark:border-gray-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* New File Previews */}
              {editAttachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {editAttachedFiles.map((file, i) => (
                    <div key={i} className="relative group flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-3 py-2 rounded-xl">
                      <div className="p-2 bg-white dark:bg-gray-900 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col pr-6">
                        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 max-w-[200px] truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-indigo-500">{formatFileSize(file.size)}</span>
                      </div>
                      <button 
                        onClick={() => setEditAttachedFiles(editAttachedFiles.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 bg-white dark:bg-gray-700 text-gray-500 hover:text-red-500 rounded-full p-1 shadow-md border border-gray-200 dark:border-gray-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={editFileInputRef}
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFilesArray = Array.from(e.target.files);
                      let dbDuplicateCount = 0;
                      let limitHit = false;
                      let sizeLimitHit = false;

                      const validFiles: File[] = [];
                      newFilesArray.forEach(file => {
                        if (file.size > 50 * 1024 * 1024) {
                          sizeLimitHit = true;
                          return;
                        }
                        const formattedSize = formatFileSize(file.size);
                        const inDB = items.some(item => item.fileName === file.name && item.fileSize === formattedSize);
                        if (inDB) {
                          dbDuplicateCount++;
                        } else {
                          validFiles.push(file);
                        }
                      });

                      setEditAttachedFiles(prev => {
                        const combined = [...prev];
                        validFiles.forEach(file => {
                          const inPending = combined.some(f => f.name === file.name && f.size === file.size);
                          if (!inPending) {
                            const originalFileCount = (editTarget.type !== 'text' && editTarget.type !== 'link' && !editFileRemoved) ? 1 : 0;
                            if (combined.length + originalFileCount < 10) {
                              combined.push(file);
                            } else {
                              limitHit = true;
                            }
                          }
                        });
                        return combined;
                      });

                      e.target.value = '';

                      setTimeout(() => {
                        if (sizeLimitHit) {
                          showNotification("Files over 50MB are not allowed");
                        } else if (dbDuplicateCount > 0) {
                          showNotification(`Skipped ${dbDuplicateCount} file(s) already saved`);
                        } else if (limitHit) {
                          showNotification("Maximum 10 files allowed");
                        }
                      }, 0);
                    }
                  }}
                  className="hidden"
                />
                <button 
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={isSavingEdit}
                  className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium disabled:opacity-50"
                >
                  <Paperclip className="w-5 h-5" />
                  <span className="hidden sm:inline">Attach</span>
                </button>
                {editAttachedFiles.length > 0 && (
                  <button 
                    onClick={() => setEditAttachedFiles([])}
                    disabled={isSavingEdit}
                    className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors font-medium disabled:opacity-50"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    setEditTarget(null);
                    setEditValue('');
                    setEditAttachedFiles([]);
                    setEditFileRemoved(false);
                  }}
                  disabled={isSavingEdit}
                  className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors font-medium disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              </div>
              
              <button 
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !hasChanges() || (!editValue.trim() && editAttachedFiles.length === 0 && (editTarget.type === 'text' || editTarget.type === 'link' || editFileRemoved))}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
              >
                {isSavingEdit ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <span>Update</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowCollectionModal(false)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl relative z-10 border border-gray-200 dark:border-gray-800 p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              {editCollectionTarget ? 'Edit Collection' : 'New Collection'}
            </h3>
            <input 
              type="text"
              value={collectionInputValue}
              onChange={e => setCollectionInputValue(e.target.value)}
              placeholder="Collection Name"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 mb-6 text-gray-900 dark:text-gray-100"
              autoFocus
              onKeyDown={e => { if(e.key === 'Enter') handleSaveCollection() }}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowCollectionModal(false)}
                className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCollection}
                disabled={!collectionInputValue.trim()}
                className="px-6 py-2 font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50"
              >
                {editCollectionTarget ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Collection Confirm Modal */}
      {deleteCollectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setDeleteCollectionTarget(null)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl relative z-10 border border-gray-200 dark:border-gray-800 p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Collection?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to delete this collection? This won't delete the items inside it, but they will no longer belong to this collection.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteCollectionTarget(null)}
                className="flex-1 px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteCollection}
                className="flex-1 px-4 py-2.5 font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-[60] animate-in fade-in slide-in-from-top-5">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="font-medium text-sm">{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
