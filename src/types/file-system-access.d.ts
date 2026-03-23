interface FilePickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: WellKnownDirectory | FileSystemHandle;
}

type WellKnownDirectory =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos';

interface Window {
  showDirectoryPicker?: (options?: FilePickerOptions) => Promise<FileSystemDirectoryHandle>;
}
