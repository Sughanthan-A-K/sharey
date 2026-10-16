'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { 
  Paperclip, Send, Search, Image as ImageIcon, Link as LinkIcon, 
  FileText, Video, File as FileIcon, Copy, Trash2, X, Download, 
  CheckCircle2, ExternalLink, LogOut, AlertTriangle, Moon, Sun, Loader2, Edit2,
  Folder, Plus, MoreVertical, MoreHorizontal, Lock, Eye, EyeOff, XCircle, ChevronDown, GripVertical,
  ChevronLeft, ChevronRight, Share2, UploadCloud, Pin
} from 'lucide-react';
import { SharedItem, ItemType, Collection, ItemFileAttachment } from '@/types';
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
  const [inputTitle, setInputTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('Saved');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  // Modals
  const [deleteTarget, setDeleteTarget] = useState<string | 'bulk' | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editTarget, setEditTarget] = useState<SharedItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editAttachedFiles, setEditAttachedFiles] = useState<File[]>([]);
  const [editExistingFiles, setEditExistingFiles] = useState<ItemFileAttachment[]>([]);
  const [editFileRemoved, setEditFileRemoved] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Pinned Items State
  const [pinnedItemIds, setPinnedItemIds] = useState<string[]>([]);

  // Search Scope State ('current' or 'global')
  const [searchScope, setSearchScope] = useState<'current' | 'global'>('current');

  // Drag Reorder Collection State
  const [draggedCollectionIndex, setDraggedCollectionIndex] = useState<number | null>(null);
  const isDraggingCollectionRef = useRef<boolean>(false);

  // Collections State
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionInputValue, setCollectionInputValue] = useState('');
  const [editCollectionTarget, setEditCollectionTarget] = useState<Collection | null>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<string | null>(null);
  const [selectedCollectionForUpload, setSelectedCollectionForUpload] = useState<string | null>(null);
  const [confirmModalCollectionSearch, setConfirmModalCollectionSearch] = useState('');
  const [editItemCollectionId, setEditItemCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | 'all' | null>(null);
  const [dragOverCollectionReorderIndex, setDragOverCollectionReorderIndex] = useState<number | null>(null);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  
  // Private Collections State
  const [isCollectionPrivate, setIsCollectionPrivate] = useState(false);
  const [collectionPin, setCollectionPin] = useState('');
  const [pinPromptConfig, setPinPromptConfig] = useState<{ collectionId: string, action: 'access' | 'edit' | 'delete' } | null>(null);
  const [pinInputValue, setPinInputValue] = useState('');
  const [showModalPin, setShowModalPin] = useState(false);
  const [showPromptPin, setShowPromptPin] = useState(false);
  const [isUnlockedBlinking, setIsUnlockedBlinking] = useState(false);
  
  // Drag & Drop onto composer
  const [isDragOverComposer, setIsDragOverComposer] = useState(false);
  const composerDragCounterRef = useRef<number>(0);

  // Collection Confirmation Modal
  const [showCollectionConfirmModal, setShowCollectionConfirmModal] = useState(false);
  const [pendingSharePayload, setPendingSharePayload] = useState<{
    text: string;
    title: string;
    files: File[];
  } | null>(null);

  // Gallery Navigation Modal
  const [previewFiles, setPreviewFiles] = useState<{ url: string; name: string; type: ItemType }[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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
      // 1. Upload any newly attached files
      const newUploadedAttachments: ItemFileAttachment[] = [];
      for (const file of editAttachedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('sharey_files').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('sharey_files').getPublicUrl(filePath);

        newUploadedAttachments.push({
          name: file.name,
          size: formatFileSize(file.size),
          url: publicUrl,
          type: getFileType(file),
          mimeType: file.type
        });
      }

      // Combine remaining existing files and new uploads
      const combinedFiles: ItemFileAttachment[] = [...editExistingFiles, ...newUploadedAttachments];
      const trimmedText = editValue.trim();
      const trimmedTitle = editTitle.trim() || null;

      if (combinedFiles.length > 0) {
        // Multi-file payload format
        const primaryType = combinedFiles.some(f => f.type === 'image') ? 'image' : combinedFiles[0].type;
        const multiPayload = {
          __sharey_multi__: true,
          text: trimmedText,
          files: combinedFiles
        };

        const { error } = await supabase
          .from('shared_items')
          .update({
            title: trimmedTitle,
            type: primaryType,
            content: JSON.stringify(multiPayload),
            file_name: combinedFiles[0].name,
            file_size: combinedFiles[0].size,
            file_url: combinedFiles[0].url,
            mime_type: combinedFiles[0].mimeType,
            collection_id: editItemCollectionId
          })
          .eq('id', editTarget.id);

        if (error) throw error;
      } else {
        // Plain text or link (all files removed or never had files)
        const finalType = detectType(trimmedText);
        const { error } = await supabase
          .from('shared_items')
          .update({
            title: trimmedTitle,
            type: finalType,
            content: trimmedText,
            file_name: null,
            file_size: null,
            file_url: null,
            mime_type: null,
            collection_id: editItemCollectionId
          })
          .eq('id', editTarget.id);

        if (error) throw error;
      }

      await fetchItems();

      setEditTarget(null);
      setEditValue('');
      setEditTitle('');
      setEditAttachedFiles([]);
      setEditExistingFiles([]);
      setEditFileRemoved(false);
      
      setToastMsg("Updated successfully");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      console.error("Upload error:", err);
      setToastMsg(err.message || "Failed to update item.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const savedCol = localStorage.getItem('sharey_active_collection');
    if (savedCol) {
      setActiveCollection(savedCol);
    }
    const savedPins = localStorage.getItem('sharey_pinned_items');
    if (savedPins) {
      try {
        setPinnedItemIds(JSON.parse(savedPins));
      } catch (e) {}
    }
    fetchItems();
  }, []);

  const togglePinItem = (itemId: string) => {
    setPinnedItemIds(prev => {
      let updated: string[];
      if (prev.includes(itemId)) {
        updated = prev.filter(id => id !== itemId);
        showNotification('Item unpinned');
      } else {
        updated = [itemId, ...prev];
        showNotification('Item pinned to top');
      }
      localStorage.setItem('sharey_pinned_items', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectActiveCollection = (colId: string | null) => {
    setActiveCollection(colId);
    if (colId) {
      localStorage.setItem('sharey_active_collection', colId);
    } else {
      localStorage.removeItem('sharey_active_collection');
    }
  };

  useEffect(() => {
    setSelectedCollectionForUpload(activeCollection);
  }, [activeCollection]);

  useEffect(() => {
    if (editTarget || deleteTarget || showLogoutConfirm || showCollectionModal || deleteCollectionTarget || showCollectionConfirmModal || showPreviewModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [editTarget, deleteTarget, showLogoutConfirm, showCollectionModal, deleteCollectionTarget, showCollectionConfirmModal, showPreviewModal]);

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

  const openGalleryAt = (files: { url: string; name: string; type: ItemType }[], index: number) => {
    setPreviewFiles(files);
    setPreviewIndex(index);
    setShowPreviewModal(true);
  };

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
      const parsedCollections: Collection[] = collectionsData.map(c => ({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
        pin: c.pin,
        createdAt: new Date(c.created_at)
      }));

      // Check saved custom order
      const savedColOrder = localStorage.getItem('sharey_collection_order');
      if (savedColOrder) {
        try {
          const orderIds: string[] = JSON.parse(savedColOrder);
          parsedCollections.sort((a, b) => {
            const indexA = orderIds.indexOf(a.id);
            const indexB = orderIds.indexOf(b.id);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
        } catch (e) {}
      }

      setCollections(parsedCollections);
    }

    const { data, error } = await supabase
      .from('shared_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data.map(d => ({
        id: d.id,
        type: d.type as ItemType,
        title: d.title,
        content: d.content,
        fileName: d.file_name,
        fileSize: d.file_size,
        fileUrl: d.file_url,
        fileItems: parseFileAttachments(d.content, d.file_url, d.file_name, d.type as ItemType),
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
        .update({ 
          name: collectionInputValue.trim(),
          is_private: isCollectionPrivate,
          pin: collectionPin.trim() || null
        })
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
        .insert({ 
          user_id: user.id, 
          name: collectionInputValue.trim(),
          is_private: isCollectionPrivate,
          pin: collectionPin.trim() || null
        });
      
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
        handleSelectActiveCollection(null);
      }
      setDeleteCollectionTarget(null);
      fetchItems();
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId);
  };

  const handleCollectionDragStart = (e: React.DragEvent, index: number) => {
    isDraggingCollectionRef.current = true;
    setDraggedCollectionIndex(index);
    e.dataTransfer.setData('collectionIndex', index.toString());
  };

  const handleCollectionReorderDrop = (targetIndex: number) => {
    setTimeout(() => {
      isDraggingCollectionRef.current = false;
    }, 150);

    if (draggedCollectionIndex === null || draggedCollectionIndex === targetIndex) {
      setDraggedCollectionIndex(null);
      setDragOverCollectionReorderIndex(null);
      return;
    }

    const reordered = [...collections];
    const [movedCol] = reordered.splice(draggedCollectionIndex, 1);
    reordered.splice(targetIndex, 0, movedCol);

    setCollections(reordered);
    setDraggedCollectionIndex(null);
    setDragOverCollectionReorderIndex(null);

    // Save order to localStorage
    const orderIds = reordered.map(c => c.id);
    localStorage.setItem('sharey_collection_order', JSON.stringify(orderIds));
    showNotification('Collections order updated');
  };

  const handleDragOver = (e: React.DragEvent, collectionId: string | null) => {
    e.preventDefault();
    const targetId = collectionId === null ? 'all' : collectionId;
    if (dragOverCollectionId !== targetId) {
      setDragOverCollectionId(targetId);
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

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const addFilesToPending = (newFilesArray: File[]) => {
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
      const inDB = items.some(item => (item.fileName === file.name && item.fileSize === formattedSize) || (item.fileItems && item.fileItems.some(fi => fi.name === file.name)));
      
      if (inDB) {
        dbDuplicateCount++;
      } else {
        validFiles.push(file);
      }
    });

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

    setTimeout(() => {
      if (sizeLimitHit) {
        showNotification("Files over 50MB are not allowed");
      } else if (dbDuplicateCount > 0) {
        showNotification(`Skipped ${dbDuplicateCount} file(s) already saved`);
      } else if (limitHit) {
        showNotification("Maximum 10 files allowed");
      }
    }, 0);
  };

  const onShareButtonClick = () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || uploading) return;

    if (selectedCollectionForUpload) {
      setPendingSharePayload({
        text: inputValue,
        title: inputTitle,
        files: [...attachedFiles]
      });
      setShowCollectionConfirmModal(true);
      return;
    }

    executeUpload();
  };

  const executeUpload = async (collectionOverride?: string | null) => {
    const targetCollectionId = collectionOverride !== undefined ? collectionOverride : selectedCollectionForUpload;
    const textToSave = pendingSharePayload ? pendingSharePayload.text : inputValue;
    const titleToSave = pendingSharePayload ? pendingSharePayload.title : inputTitle;
    const filesToSave = pendingSharePayload ? pendingSharePayload.files : attachedFiles;

    if ((!textToSave.trim() && filesToSave.length === 0) || uploading) return;

    setUploading(true);
    setShowCollectionConfirmModal(false);
    setPendingSharePayload(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }

    try {
      if (filesToSave.length > 0) {
        const uploadedAttachments: ItemFileAttachment[] = [];
        
        for (const file of filesToSave) {
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

          uploadedAttachments.push({
            name: file.name,
            size: formatFileSize(file.size),
            url: publicUrl,
            type: getFileType(file),
            mimeType: file.type
          });
        }

        const primaryType = uploadedAttachments.some(f => f.type === 'image') ? 'image' : uploadedAttachments[0].type;
        const multiPayload = {
          __sharey_multi__: true,
          text: textToSave.trim() || '',
          files: uploadedAttachments
        };

        const { data, error: dbError } = await supabase
          .from('shared_items')
          .insert({
            user_id: user.id,
            type: primaryType,
            title: titleToSave.trim() || null,
            content: JSON.stringify(multiPayload),
            file_name: uploadedAttachments[0].name,
            file_size: uploadedAttachments[0].size,
            file_url: uploadedAttachments[0].url,
            mime_type: uploadedAttachments[0].mimeType,
            collection_id: targetCollectionId
          })
          .select()
          .single();

        if (dbError) throw dbError;

        const newItem: SharedItem = {
          id: data.id,
          type: data.type as ItemType,
          title: data.title,
          content: data.content,
          fileName: data.file_name,
          fileSize: data.file_size,
          fileUrl: data.file_url,
          fileItems: uploadedAttachments,
          collectionId: data.collection_id,
          createdAt: new Date(data.created_at)
        };

        setItems([newItem, ...items]);
      } else if (textToSave.trim()) {
        const { data, error } = await supabase
          .from('shared_items')
          .insert({
            user_id: user.id,
            type: detectType(textToSave),
            title: titleToSave.trim() || null,
            content: textToSave,
            collection_id: targetCollectionId
          })
          .select()
          .single();

        if (error) throw error;

        const newItem: SharedItem = {
          id: data.id,
          type: data.type as ItemType,
          title: data.title,
          content: data.content,
          collectionId: data.collection_id,
          createdAt: new Date(data.created_at)
        };

        setItems([newItem, ...items]);
      }

      setInputValue('');
      setInputTitle('');
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
      addFilesToPending(newFilesArray);
      e.target.value = '';
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
        if (item.fileItems && item.fileItems.length > 0) {
          for (const fi of item.fileItems) {
            try {
              const urlObj = new URL(fi.url);
              const parts = urlObj.pathname.split('/sharey_files/');
              if (parts.length > 1) {
                await supabase.storage.from('sharey_files').remove([parts[1]]);
              }
            } catch (e) {}
          }
        } else if (item.fileUrl) {
          try {
            const urlObj = new URL(item.fileUrl);
            const parts = urlObj.pathname.split('/sharey_files/');
            if (parts.length > 1) {
              await supabase.storage.from('sharey_files').remove([parts[1]]);
            }
          } catch (e) {}
        }
      }
      await supabase.from('shared_items').delete().in('id', idsToDelete);
      setItems(items.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
    } else {
      const id = deleteTarget;
      const itemToDelete = items.find(i => i.id === id);
      if (itemToDelete) {
        if (itemToDelete.fileItems && itemToDelete.fileItems.length > 0) {
          for (const fi of itemToDelete.fileItems) {
            try {
              const urlObj = new URL(fi.url);
              const parts = urlObj.pathname.split('/sharey_files/');
              if (parts.length > 1) {
                await supabase.storage.from('sharey_files').remove([parts[1]]);
              }
            } catch (e) {}
          }
        } else if (itemToDelete.fileUrl) {
          try {
            const urlObj = new URL(itemToDelete.fileUrl);
            const parts = urlObj.pathname.split('/sharey_files/');
            if (parts.length > 1) {
              const filePath = parts[1];
              await supabase.storage.from('sharey_files').remove([filePath]);
            }
          } catch (e) {}
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

  const filteredItems = items
    .filter(item => {
      const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (item.title && item.title.toLowerCase().includes(q)) ||
        item.content.toLowerCase().includes(q) || 
        (item.fileName && item.fileName.toLowerCase().includes(q)) ||
        (item.fileItems && item.fileItems.some(fi => fi.name.toLowerCase().includes(q)));
      
      let matchesCollection = true;
      if (searchQuery.trim() && searchScope === 'global') {
        // Global search searches across all collections except private locked collections
        const parentCol = collections.find(c => c.id === item.collectionId);
        if (parentCol?.isPrivate) {
          matchesCollection = false;
        } else {
          matchesCollection = true;
        }
      } else if (activeCollection) {
        matchesCollection = item.collectionId === activeCollection;
      } else {
        // In "All Items", hide items that belong to a private collection
        const parentCol = collections.find(c => c.id === item.collectionId);
        if (parentCol?.isPrivate) {
          matchesCollection = false;
        }
      }
      
      return matchesFilter && matchesSearch && matchesCollection;
    })
    .sort((a, b) => {
      const aPinned = pinnedItemIds.includes(a.id);
      const bPinned = pinnedItemIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
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
    const originalText = getDisplayContent(editTarget);
    const textChanged = editValue.trim() !== originalText.trim();
    
    // 2. Existing files changed (removed any)?
    const initialFiles = editTarget.fileItems && editTarget.fileItems.length > 0
      ? editTarget.fileItems
      : (editTarget.fileUrl ? [{ name: editTarget.fileName || 'file', url: editTarget.fileUrl, type: editTarget.type }] : []);
    const filesRemoved = editExistingFiles.length !== initialFiles.length;
    
    // 3. New files attached?
    const newFilesAdded = editAttachedFiles.length > 0;
    
    // 4. Collection changed?
    const collectionChanged = editItemCollectionId !== (editTarget.collectionId || null);

    // 5. Title changed?
    const originalTitle = editTarget.title || '';
    const titleChanged = editTitle.trim() !== originalTitle.trim();

    return textChanged || filesRemoved || newFilesAdded || collectionChanged || titleChanged;
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
          <div 
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              composerDragCounterRef.current += 1;
              if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                setIsDragOverComposer(true);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'copy';
              if (!isDragOverComposer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                setIsDragOverComposer(true);
              }
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              composerDragCounterRef.current = Math.max(0, composerDragCounterRef.current - 1);
              if (composerDragCounterRef.current === 0) {
                setIsDragOverComposer(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              composerDragCounterRef.current = 0;
              setIsDragOverComposer(false);
              
              // Handle dropped files from desktop / explorer / browser
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const droppedFiles = Array.from(e.dataTransfer.files);
                addFilesToPending(droppedFiles);
              } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                const itemsList: File[] = [];
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                  const item = e.dataTransfer.items[i];
                  if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f) itemsList.push(f);
                  }
                }
                if (itemsList.length > 0) {
                  addFilesToPending(itemsList);
                }
              }
            }}
            className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border transition-all focus-within:shadow-md focus-within:border-indigo-300 dark:focus-within:border-indigo-500 relative z-20 ${
              isDragOverComposer 
                ? 'border-indigo-500 ring-2 ring-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20' 
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            {isDragOverComposer && (
              <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center pointer-events-none z-30 border-2 border-dashed border-indigo-500 animate-in fade-in">
                <UploadCloud className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-bounce mb-2" />
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Drop files here to attach</p>
              </div>
            )}

            <div className="relative w-full">
              <input
                type="text"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                disabled={uploading}
                placeholder="Title (optional)"
                className="w-full px-4 pt-4 pb-2 text-gray-900 dark:text-gray-100 font-semibold bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-lg sm:text-xl disabled:opacity-50 pr-10"
              />
              {inputTitle && (
                <button
                  onClick={() => setInputTitle('')}
                  disabled={uploading}
                  className="absolute right-3 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <textarea 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={uploading}
              placeholder="Paste a link, type something, or share anything..."
              className="w-full px-4 pb-4 pt-2 min-h-[80px] lg:min-h-[100px] resize-none outline-none text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base sm:text-lg bg-transparent disabled:opacity-50"
            />
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              multiple 
              className="hidden" 
            />

            {attachedFiles.length > 0 && (
              <div className="pl-4 pr-3 pb-3 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                {attachedFiles.map((file, idx) => {
                  const isImg = file.type.startsWith('image/');
                  const tempUrl = isImg ? URL.createObjectURL(file) : null;
                  return (
                    <div key={idx} className="flex items-center gap-2.5 p-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl w-full">
                      {isImg && tempUrl ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={tempUrl} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 rounded-md shadow-sm shrink-0 flex items-center justify-center">
                          {getIconForType(getFileType(file))}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      {!uploading && (
                        <button onClick={() => removeAttachedFile(idx)} className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900 px-3.5 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap justify-between items-center transition-colors gap-2 rounded-b-2xl">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {collections.length > 0 && (
                  <div className="relative">
                    <button 
                      onClick={() => setIsUploadDropdownOpen(!isUploadDropdownOpen)}
                      disabled={uploading}
                      className="flex items-center gap-1.5 bg-white dark:bg-gray-800 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-750 focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors disabled:opacity-50 shadow-2xs"
                    >
                      <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[90px] sm:max-w-[120px]">
                        {selectedCollectionForUpload ? collections.find(c => c.id === selectedCollectionForUpload)?.name : 'My Collections'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    </button>
                    
                    {isUploadDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsUploadDropdownOpen(false)}></div>
                        <div className="absolute left-0 top-full mt-1.5 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                          <button
                            onClick={() => {
                              setSelectedCollectionForUpload(null);
                              setIsUploadDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!selectedCollectionForUpload ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                          >
                            No Collection (All Items)
                          </button>
                          {collections.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedCollectionForUpload(c.id);
                                setIsUploadDropdownOpen(false);
                              }}
                              className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedCollectionForUpload === c.id ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20' : 'text-gray-700 dark:text-gray-300'}`}
                            >
                              {c.isPrivate ? <Lock className="w-3.5 h-3.5 shrink-0 opacity-50" /> : <Folder className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                              <span className="truncate">{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex shrink-0 items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors font-medium text-xs sm:text-sm disabled:opacity-50"
                  title="Attach Files"
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="hidden sm:inline">Attach</span>
                </button>
                {(attachedFiles.length > 0 || inputValue.trim().length > 0) && (
                  <button 
                    onClick={() => { setAttachedFiles([]); setInputValue(''); setInputTitle(''); }}
                    disabled={uploading}
                    className="flex shrink-0 items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-xs sm:text-sm disabled:opacity-50"
                    title="Clear All"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
              <button 
                onClick={onShareButtonClick}
                disabled={(!inputValue.trim() && attachedFiles.length === 0) || uploading}
                className="flex shrink-0 items-center gap-1.5 bg-gray-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-gray-800 dark:hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm transition-all shadow-sm active:scale-95 ml-auto"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{uploading ? '...' : 'SHARE'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Filters & Search (Sticky on Desktop) */}
        <div className="lg:col-span-3 lg:sticky lg:top-24 order-2 lg:order-3">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeCollection ? `Search ${searchScope === 'current' ? 'in this collection' : 'everywhere'}...` : "Search all saved items..."}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-9 pr-8 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/50 transition-all text-sm dark:text-gray-100 shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scope Selector: Show when activeCollection is selected */}
            {activeCollection && (
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-850 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setSearchScope('current')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                    searchScope === 'current'
                      ? 'bg-white dark:bg-gray-750 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  This Collection
                </button>
                <button
                  onClick={() => setSearchScope('global')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                    searchScope === 'global'
                      ? 'bg-white dark:bg-gray-750 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Search Everywhere
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {['all', 'text', 'link', 'image', 'video', 'file'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border shadow-sm ${
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
                  setIsCollectionPrivate(false);
                  setCollectionPin('');
                  setShowCollectionModal(true);
                }}
                className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                title="New Collection"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-3">
              <button
                onClick={() => handleSelectActiveCollection(null)}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropToCollection(e, null)}
                className={`w-full flex items-center justify-start px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeCollection === null
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                } ${dragOverCollectionId === 'all' ? 'ring-2 ring-indigo-400 border-transparent bg-indigo-50 dark:bg-indigo-900/40' : ''}`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">All Items</span>
                </div>
              </button>
              
              {collections.map((col, index) => {
                const searchQ = searchQuery.toLowerCase().trim();
                const matchingItemsCount = searchQ ? items.filter(it => {
                  if (it.collectionId !== col.id) return false;
                  return (it.title && it.title.toLowerCase().includes(searchQ)) ||
                    it.content.toLowerCase().includes(searchQ) ||
                    (it.fileName && it.fileName.toLowerCase().includes(searchQ)) ||
                    (it.fileItems && it.fileItems.some(fi => fi.name.toLowerCase().includes(searchQ)));
                }).length : 0;

                return (
                <div key={col.id} className="relative">
                  {/* Drop Indicator Line */}
                  {dragOverCollectionReorderIndex === index && (
                    <div className="absolute -top-1.5 left-0 right-0 h-1 bg-indigo-500 rounded-full z-10 shadow-sm animate-pulse" />
                  )}
                  <div 
                    onDragOver={(e) => {
                      handleDragOver(e, col.id);
                      e.preventDefault();
                      if (draggedCollectionIndex !== null && dragOverCollectionReorderIndex !== index) {
                        setDragOverCollectionReorderIndex(index);
                      }
                    }}
                    onDragLeave={(e) => {
                      handleDragLeave(e);
                      if (dragOverCollectionReorderIndex === index) {
                        setDragOverCollectionReorderIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      const collectionIndexData = e.dataTransfer.getData('collectionIndex');
                      if (collectionIndexData !== '') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCollectionReorderDrop(index);
                      } else {
                        handleDropToCollection(e, col.id);
                      }
                    }}
                    className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      activeCollection === col.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    } ${dragOverCollectionId === col.id ? 'ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 border-transparent' : ''} ${
                      draggedCollectionIndex === index ? 'opacity-40 scale-[0.98]' : ''
                    } ${matchingItemsCount > 0 && activeCollection !== col.id ? 'border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}
                    onClick={() => {
                      if (isDraggingCollectionRef.current) return;
                      // If clicking the currently selected collection, toggle unselect back to All Items
                      if (activeCollection === col.id) {
                        handleSelectActiveCollection(null);
                        return;
                      }
                      if (col.isPrivate && col.pin) {
                        setPinPromptConfig({ collectionId: col.id, action: 'access' });
                        setPinInputValue('');
                      } else {
                        handleSelectActiveCollection(col.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 pr-2 min-w-0 flex-1">
                      <div 
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleCollectionDragStart(e, index);
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation();
                          setDraggedCollectionIndex(null);
                          setDragOverCollectionReorderIndex(null);
                          setTimeout(() => {
                            isDraggingCollectionRef.current = false;
                          }, 150);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 p-0.5"
                        title="Drag handle to reorder collection"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      {col.isPrivate ? (
                        <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="truncate">{col.name}</span>
                      {matchingItemsCount > 0 && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0 animate-in fade-in" title={`${matchingItemsCount} matching item${matchingItemsCount > 1 ? 's' : ''}`}>
                          {matchingItemsCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (col.isPrivate && col.pin) {
                            setPinPromptConfig({ collectionId: col.id, action: 'edit' });
                            setPinInputValue('');
                          } else {
                            setEditCollectionTarget(col);
                            setCollectionInputValue(col.name);
                            setIsCollectionPrivate(col.isPrivate || false);
                            setCollectionPin(col.pin || '');
                            setShowCollectionModal(true);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-indigo-600"
                        title="Edit Collection"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const link = `${window.location.origin}/c/${col.id}`;
                          navigator.clipboard.writeText(link);
                          showNotification('Collection link copied to clipboard!', 'success');
                        }}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Copy public link"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (col.isPrivate && col.pin) {
                            setPinPromptConfig({ collectionId: col.id, action: 'delete' });
                            setPinInputValue('');
                          } else {
                            setDeleteCollectionTarget(col.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete Collection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
              
              {collections.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-500">
                  No collections yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Feed (Scrollable) */}
        <div className={`lg:col-span-6 min-w-0 space-y-4 order-3 lg:order-2 ${isUnlockedBlinking ? 'animate-border-blink' : ''}`}>
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
            filteredItems.map(item => {
              const cardFiles = item.fileItems && item.fileItems.length > 0 
                ? item.fileItems 
                : (item.fileUrl ? [{ name: item.fileName || 'file', size: item.fileSize, url: item.fileUrl, type: item.type }] : []);
              const textContent = getDisplayContent(item);

              return (
              <div 
                key={item.id} 
                className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 sm:p-5 transition-all min-w-0 ${selectedItems.has(item.id) ? 'border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400 dark:ring-indigo-500 shadow-sm' : 'border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700'}`}
              >
                
                {/* Header with Icon */}
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div 
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hidden sm:block"
                      title="Drag to collection"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <label className="flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      />
                    </label>
                    <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg shrink-0">
                      {getIconForType(item.type)}
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md uppercase tracking-wider shrink-0">
                      {item.type}
                    </span>
                    {item.collectionId && collections.find(c => c.id === item.collectionId) && (() => {
                      const parentCol = collections.find(c => c.id === item.collectionId)!;
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (parentCol.isPrivate && parentCol.pin) {
                              setPinPromptConfig({ collectionId: parentCol.id, action: 'access' });
                              setPinInputValue('');
                            } else {
                              handleSelectActiveCollection(parentCol.id);
                              if (searchQuery.trim()) {
                                setSearchScope('current');
                              }
                            }
                          }}
                          className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-1 rounded-md flex items-center gap-1 whitespace-nowrap max-w-[140px] sm:max-w-[200px] truncate transition-colors cursor-pointer group/coltag"
                          title={`View in ${parentCol.name} collection`}
                        >
                          {parentCol.isPrivate ? <Lock className="w-3 h-3 shrink-0" /> : <Folder className="w-3 h-3 shrink-0" />}
                          <span className="truncate group-hover/coltag:underline">{parentCol.name}</span>
                        </button>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePinItem(item.id)}
                      className={`p-1.5 rounded-lg transition-all ${
                        pinnedItemIds.includes(item.id)
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-200 shadow-2xs'
                          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title={pinnedItemIds.includes(item.id) ? 'Unpin card' : 'Pin card to top'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${pinnedItemIds.includes(item.id) ? 'fill-amber-500 rotate-45' : ''}`} />
                    </button>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap shrink-0">
                      {format(item.createdAt, 'MMM d · h:mm a')}
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="pl-8 mb-4 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {pinnedItemIds.includes(item.id) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 px-2 py-0.5 rounded-md">
                        <Pin className="w-3 h-3 fill-amber-500 rotate-45" /> Pinned
                      </span>
                    )}
                    {item.title && (
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base break-words flex-1">{item.title}</h4>
                    )}
                  </div>

                  {/* Text or Link */}
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

                                  {/* +More Badge Overlay if exceeding maxVisible */}
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

                {/* Card Actions */}
                <div className="pl-8 flex flex-wrap gap-2 mt-1">
                  {textContent && (
                    <button onClick={() => handleCopy(textContent)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
                      <Copy className="w-3.5 h-3.5" /> Copy Text
                    </button>
                  )}
                  {cardFiles.length === 1 && (
                    <a href={`${cardFiles[0].url}?download=${encodeURIComponent(cardFiles[0].name)}`} download={cardFiles[0].name} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  )}
                  {/* Share Link for every card */}
                  <button 
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/item/${item.id}`;
                      handleCopy(shareUrl);
                      showNotification('Share link copied to clipboard');
                    }} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/40 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </button>
                  <button onClick={() => {
                    setEditTarget(item);
                    setEditTitle(item.title || '');
                    setEditValue(textContent);
                    setEditAttachedFiles([]);
                    const existing = item.fileItems && item.fileItems.length > 0 
                      ? [...item.fileItems] 
                      : (item.fileUrl ? [{ name: item.fileName || 'file', size: item.fileSize, url: item.fileUrl, type: item.type }] : []);
                    setEditExistingFiles(existing);
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
            );
          })
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
              <div className="relative mb-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full bg-transparent outline-none text-gray-900 dark:text-gray-100 font-bold text-xl placeholder-gray-400 dark:placeholder-gray-500 pr-10 border-b border-transparent focus:border-gray-200 dark:focus:border-gray-800 pb-2 transition-colors disabled:opacity-50"
                  disabled={isSavingEdit}
                />
                {editTitle && (
                  <button
                    onClick={() => setEditTitle('')}
                    disabled={isSavingEdit}
                    className="absolute right-1 top-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Type a note or paste a link..."
                className="w-full bg-transparent resize-none outline-none min-h-[300px] text-gray-800 dark:text-gray-200 text-lg placeholder-gray-400 dark:placeholder-gray-500 mb-4 disabled:opacity-50"
                disabled={isSavingEdit}
              />

              {/* Existing Files Preview (Supports multi-file) */}
              {editExistingFiles.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {editExistingFiles.map((file, i) => (
                    <div key={i} className="relative group flex items-center gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl">
                      <div className="p-2 bg-white dark:bg-gray-900 rounded-lg text-indigo-600 dark:text-indigo-400">
                        {getIconForType(file.type)}
                      </div>
                      <div className="flex flex-col pr-6">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                          {file.name}
                        </span>
                        {file.size && <span className="text-xs text-gray-500">{file.size}</span>}
                      </div>
                      <button 
                        onClick={() => {
                          setEditExistingFiles(prev => prev.filter((_, idx) => idx !== i));
                          setEditFileRemoved(true);
                        }}
                        className="absolute -top-2 -right-2 bg-white dark:bg-gray-700 text-gray-500 hover:text-red-500 rounded-full p-1 shadow-md border border-gray-200 dark:border-gray-600 transition-colors"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
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
                        title="Remove file"
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
                        const inDB = items.some(item => (item.fileName === file.name && item.fileSize === formattedSize) || (item.fileItems && item.fileItems.some(fi => fi.name === file.name)));
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
                          const inExisting = editExistingFiles.some(f => f.name === file.name);
                          if (!inPending && !inExisting) {
                            if (combined.length + editExistingFiles.length < 10) {
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
                {(editAttachedFiles.length > 0 || editExistingFiles.length > 0) && (
                  <button 
                    onClick={() => {
                      setEditAttachedFiles([]);
                      setEditExistingFiles([]);
                      setEditFileRemoved(true);
                    }}
                    disabled={isSavingEdit}
                    className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors font-medium disabled:opacity-50"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Clear All Files</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    setEditTarget(null);
                    setEditValue('');
                    setEditTitle('');
                    setEditAttachedFiles([]);
                    setEditExistingFiles([]);
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
                disabled={isSavingEdit || !hasChanges() || (!editValue.trim() && editAttachedFiles.length === 0 && editExistingFiles.length === 0)}
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
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 mb-4 text-gray-900 dark:text-gray-100"
              autoFocus
              onKeyDown={e => { if(e.key === 'Enter') handleSaveCollection() }}
            />

            <label className="flex items-center gap-2 mb-4 cursor-pointer text-gray-700 dark:text-gray-300">
              <input 
                type="checkbox" 
                checked={isCollectionPrivate}
                onChange={(e) => {
                  setIsCollectionPrivate(e.target.checked);
                  if (!e.target.checked) setCollectionPin('');
                }}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
              />
              <span className="text-sm font-medium">Private Collection (Hide from All Items)</span>
            </label>

            {isCollectionPrivate && (
              <div className="relative mb-6 animate-in slide-in-from-top-2">
                <input 
                  type={showModalPin ? "text" : "password"}
                  value={collectionPin}
                  onChange={e => setCollectionPin(e.target.value)}
                  placeholder="Optional PIN (e.g. 1234)"
                  autoComplete="new-password"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-gray-900 dark:text-gray-100 pr-12"
                  onKeyDown={e => { if(e.key === 'Enter') handleSaveCollection() }}
                />
                <button
                  type="button"
                  onClick={() => setShowModalPin(!showModalPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showModalPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2">
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

      {/* PIN Prompt Modal */}
      {pinPromptConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setPinPromptConfig(null)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl relative z-10 border border-gray-200 dark:border-gray-800 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5 mb-6">
              <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 
                className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center select-none"
                onDoubleClick={() => {
                  const col = collections.find(c => c.id === pinPromptConfig.collectionId);
                  if (col && col.pin) {
                    setPinInputValue(col.pin);
                    setShowPromptPin(true);
                  }
                }}
              >
                Enter PIN
                <span className="text-gray-500 dark:text-gray-400 font-medium text-sm ml-2 truncate max-w-[150px]">
                  for {collections.find(c => c.id === pinPromptConfig.collectionId)?.name}
                </span>
              </h3>
            </div>
            
            <div className="relative mb-6">
              <input 
                type={showPromptPin ? "text" : "password"}
                value={pinInputValue}
                onChange={e => setPinInputValue(e.target.value)}
                placeholder="Enter PIN"
                autoComplete="new-password"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-gray-900 dark:text-gray-100 pr-12"
                autoFocus
                onKeyDown={e => { 
                  if(e.key === 'Enter') {
                    const col = collections.find(c => c.id === pinPromptConfig.collectionId);
                    if (col && col.pin === pinInputValue) {
                      if (pinPromptConfig.action === 'access') {
                        handleSelectActiveCollection(pinPromptConfig.collectionId);
                        if (searchQuery.trim()) {
                          setSearchScope('current');
                        }
                        setIsUnlockedBlinking(true);
                        setTimeout(() => setIsUnlockedBlinking(false), 1500);
                      } else if (pinPromptConfig.action === 'edit') {
                        setEditCollectionTarget(col);
                        setCollectionInputValue(col.name);
                        setIsCollectionPrivate(col.isPrivate || false);
                        setCollectionPin(col.pin || '');
                        setShowCollectionModal(true);
                      } else if (pinPromptConfig.action === 'delete') {
                        setDeleteCollectionTarget(col.id);
                      }
                      
                      setPinPromptConfig(null);
                    } else {
                      showNotification('Incorrect PIN', 'error');
                    }
                  } 
                }}
              />
              <button
                type="button"
                onClick={() => setShowPromptPin(!showPromptPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPromptPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setPinPromptConfig(null)}
                className="flex-1 px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const col = collections.find(c => c.id === pinPromptConfig.collectionId);
                  if (col && col.pin === pinInputValue) {
                    if (pinPromptConfig.action === 'access') {
                      handleSelectActiveCollection(pinPromptConfig.collectionId);
                      if (searchQuery.trim()) {
                        setSearchScope('current');
                      }
                      setIsUnlockedBlinking(true);
                      setTimeout(() => setIsUnlockedBlinking(false), 1500);
                    } else if (pinPromptConfig.action === 'edit') {
                      setEditCollectionTarget(col);
                      setCollectionInputValue(col.name);
                      setIsCollectionPrivate(col.isPrivate || false);
                      setCollectionPin(col.pin || '');
                      setShowCollectionModal(true);
                    } else if (pinPromptConfig.action === 'delete') {
                      setDeleteCollectionTarget(col.id);
                    }
                    
                    setPinPromptConfig(null);
                  } else {
                    showNotification('Incorrect PIN', 'error');
                  }
                }}
                disabled={!pinInputValue.trim()}
                className="flex-1 px-4 py-2.5 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm hover:shadow hover:-translate-y-0.5 disabled:opacity-50"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-[60] animate-in fade-in slide-in-from-top-5">
          {toastType === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="font-medium text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Collection Confirmation Modal */}
      {showCollectionConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowCollectionConfirmModal(false)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl relative z-10 border border-gray-200 dark:border-gray-800 p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
              <Folder className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Save to Collection?</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              You are about to save this to{' '}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                &quot;{collections.find(c => c.id === selectedCollectionForUpload)?.name || 'Selected Collection'}&quot;
              </span>.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Destination Collection:
              </label>

              {/* Search input for collections */}
              {collections.length > 3 && (
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={confirmModalCollectionSearch}
                    onChange={(e) => setConfirmModalCollectionSearch(e.target.value)}
                    placeholder="Search collections..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500"
                  />
                  {confirmModalCollectionSearch && (
                    <button
                      onClick={() => setConfirmModalCollectionSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Scrollable list of collections with clear selected state */}
              <div className="max-h-44 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-700 rounded-xl p-1 bg-gray-50 dark:bg-gray-800/60 divide-y divide-gray-100 dark:divide-gray-800/40">
                <button
                  type="button"
                  onClick={() => setSelectedCollectionForUpload(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                    selectedCollectionForUpload === null
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className={`w-4 h-4 shrink-0 ${selectedCollectionForUpload === null ? 'text-white' : 'text-gray-400'}`} />
                    <span className="truncate">No Collection (All Items)</span>
                  </div>
                  {selectedCollectionForUpload === null && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                </button>

                {collections
                  .filter(c => c.name.toLowerCase().includes(confirmModalCollectionSearch.toLowerCase()))
                  .map(c => {
                    const isSelected = selectedCollectionForUpload === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCollectionForUpload(c.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {c.isPrivate ? (
                            <Lock className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          ) : (
                            <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                          )}
                          <span className="truncate">{c.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowCollectionConfirmModal(false)}
                className="flex-1 px-4 py-2.5 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => executeUpload(selectedCollectionForUpload)}
                className="flex-1 px-4 py-2.5 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm hover:shadow"
              >
                Confirm &amp; Share
              </button>
            </div>
          </div>
        </div>
      )}

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
