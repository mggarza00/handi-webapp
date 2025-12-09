"use client";
import { create } from "zustand";

type State = {
  status: string | "";
  city: string | "";
  query: string;
};

type Actions = {
  setStatus: (v: State["status"]) => void;
  setCity: (v: State["city"]) => void;
  setQuery: (v: string) => void;
  reset: () => void;
};

export const useAdminRequestFilters = create<State & Actions>((set) => ({
  status: "",
  city: "",
  query: "",
  setStatus: (status) => set({ status }),
  setCity: (city) => set({ city }),
  setQuery: (query) => set({ query }),
  reset: () => set({ status: "", city: "", query: "" }),
}));

