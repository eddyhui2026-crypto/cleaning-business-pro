import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/api';
import { Camera, Loader2 } from 'lucide-react';
import { DATA_RETENTION_SHORT } from '../lib/dataRetention';

interface Props {
  jobId: string;
  type: 'before' | 'after';
  onUploadSuccess: (url: string) => void;
}

export const PhotoUpload = ({ jobId, type, onUploadSuccess }: Props) => {
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${jobId}/${type}_${Math.random()}.${fileExt}`;
      const filePath = `job-photos/${fileName}`;

      // 1. Upload to Supabase Bucket
      const { error: uploadError } = await supabase.storage
        .from('cleaning-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data } = supabase.storage.from('cleaning-photos').getPublicUrl(filePath);

      // 3. Save reference to our Database
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const response = await fetch(apiUrl(`/api/jobs/${jobId}/photos`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: data.publicUrl, type }),
      });

      if (response.ok) onUploadSuccess(data.publicUrl);

    } catch (error) {
      alert('Error uploading photo!');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4">
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
        {uploading ? (
          <Loader2 className="animate-spin text-slate-400" />
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Camera className="w-8 h-8 mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">Add {type} photo</p>
          </div>
        )}
        <input type="file" className="hidden" accept="image/*" onChange={uploadPhoto} disabled={uploading} />
      </label>
      <p className="text-[10px] text-slate-500 mt-2 italic">{DATA_RETENTION_SHORT}</p>
    </div>
  );
};