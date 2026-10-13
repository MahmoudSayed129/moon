import { useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  currentImage?: string;
  onImageChange: (image: string | undefined) => void;
}

const ImageUpload = ({ currentImage, onImageChange }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('من فضلك اختار ملف صورة');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      shrinkImage(result).then(onImageChange);
    };
    reader.readAsDataURL(file);
  };

  // Images are stored in the browser's local storage (~5 MB total), so
  // downscale big photos to a thumbnail-sized JPEG before saving.
  const shrinkImage = (dataUrl: string, maxSize = 600) =>
    new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(dataUrl);
          return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      image.onerror = () => resolve(dataUrl);
      image.src = dataUrl;
    });

  const removeImage = () => {
    onImageChange(undefined);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">صورة المنتج</label>

      {currentImage ? (
        <div className="relative w-32 h-32">
          <img
            src={currentImage}
            alt="معاينة المنتج"
            className="w-32 h-32 object-cover rounded-lg border border-gray-300"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
            aria-label="حذف الصورة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
            isDragging ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <ImageIcon className="mx-auto w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-2">اسحب الصورة هنا أو دوس علشان تختار من الجهاز</p>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="inline-flex items-center px-3 py-1 bg-black text-white text-sm rounded-md hover:bg-gray-800 cursor-pointer"
          >
            <Upload className="w-3 h-3 ml-1" />
            رفع صورة
          </label>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
