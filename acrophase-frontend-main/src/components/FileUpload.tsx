import React, { useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onFileRemove: () => void;
}

const FileUpload = ({
  onFileSelect,
  selectedFile,
  onFileRemove,
}: FileUploadProps) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (
          file.type === "text/csv" ||
          file.type === "application/vnd.ms-excel" ||
          file.type ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
          onFileSelect(file);
        }
      }
    },
    [onFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  if (selectedFile) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-green-700">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={onFileRemove}
            className="p-1 hover:bg-green-100 rounded-full transition-colors"
            aria-label="Remove file"
          >
            <X className="h-4 w-4 text-green-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <p className="text-lg font-medium text-gray-900 mb-2">Upload Data</p>
      <p className="text-sm text-gray-600 mb-4">
        Drag and drop your CSV or Excel file here, or click to browse
      </p>
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileInput}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 cursor-pointer transition-colors"
      >
        Select File
      </label>
      <p className="text-xs text-gray-500 mt-2">
        Supported formats: CSV, Excel (.xlsx, .xls)
      </p>
    </div>
  );
};

export default FileUpload;
