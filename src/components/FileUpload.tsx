import { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload = ({ onFileSelect }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        const file = files[0];
        if (file.type === "application/pdf") {
          setSelectedFile(file);
          onFileSelect(file);
        } else {
          toast({
            title: "Invalid file type",
            description: "Please upload a PDF file.",
            variant: "destructive",
          });
        }
      }
    },
    [onFileSelect, toast]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        const file = files[0];
        if (file.type === "application/pdf") {
          setSelectedFile(file);
          onFileSelect(file);
        } else {
          toast({
            title: "Invalid file type",
            description: "Please upload a PDF file.",
            variant: "destructive",
          });
        }
      }
    },
    [onFileSelect, toast]
  );

  return (
    <Card
      className={`relative border-2 border-dashed transition-all duration-300 ${
        isDragging
          ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
          : "border-border hover:border-primary/50"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 space-y-3 sm:space-y-4">
        <div className="p-4 sm:p-6 rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
          {selectedFile ? (
            <FileText className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-primary" />
          ) : (
            <Upload className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-muted-foreground" />
          )}
        </div>
        
        <div className="text-center space-y-1 sm:space-y-2">
          <p className="text-sm sm:text-base md:text-lg font-semibold text-foreground break-all sm:break-normal">
            {selectedFile ? selectedFile.name : "Drop your PDF here"}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {selectedFile
              ? "PDF file selected successfully"
              : "or click to browse your files"}
          </p>
        </div>

        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <Button 
          asChild 
          variant="outline" 
          size="sm" 
          className="sm:size-default md:size-lg"
        >
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Browse PDF Files
          </label>
        </Button>

        {selectedFile && (
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <div>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
            <div className="text-green-600 font-medium">✓ PDF Ready</div>
          </div>
        )}
      </div>
    </Card>
  );
};
