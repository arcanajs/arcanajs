export interface Post {
  id: number;
  title: string;
}

export interface HomePageData {
  welcome: string;
  subtitle?: string;
  time?: string;
  posts?: Post[];
}
