export interface Command {
  id: string;
  category: string;
  name: string;
  description: string;
  code?: string;
  mac?: string;
  win?: string;
}

export interface Category {
  name: string;
  commands: Command[];
}
