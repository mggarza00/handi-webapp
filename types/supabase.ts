export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      [table: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: any[];
      };
    };
    Views: {
      [view: string]: {
        Row: Record<string, any>;
        Relationships: any[];
      };
    };
    Functions: {
      [fn: string]: {
        Args: Record<string, any>;
        Returns: any;
      };
    };
    Enums: {
      [enumName: string]: string;
    };
    CompositeTypes: {
      [typeName: string]: Record<string, any>;
    };
  };
}

export type PublicSchema = Database["public"];
export type Tables = PublicSchema["Tables"];
export type Views = PublicSchema["Views"];
export type Functions = PublicSchema["Functions"];
export type Enums = PublicSchema["Enums"];
export type CompositeTypes = PublicSchema["CompositeTypes"];
export type TableRow<T extends keyof Tables> = Tables[T]["Row"];
export type TableInsert<T extends keyof Tables> = Tables[T]["Insert"];
export type TableUpdate<T extends keyof Tables> = Tables[T]["Update"];
