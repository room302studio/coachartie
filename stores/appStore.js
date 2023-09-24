// Import defineStore from Pinia.
import { defineStore } from "pinia";

// Define the usage of the store. Use the name of your store in camel case. For example, 'useBaseStore' for 'base' store.
export const useAppStore = defineStore("base", {
  // The state function returns a object containing all properties of the state.
  // We use useLocalStorage here to persist data in the local storage.
  state: () => {
    return {
      activeItem: useLocalStorage("activeItem", null), // Replace "item" with your model name.
      itemList: useLocalStorage("itemList", []), // Replace "item" with your model name and "List" with your list name.
    };
  },

  // This object contains all methods that will mutate the state.
  actions: {
    // Method to set active item. Replace 'Item' with your model name.
    setActiveItem(item) {
      this.activeItem = item;
    },

    // Method to add an item to the item list. Replace 'Item' with your model name.
    addItem(item) {
      this.itemList.push(item);
    },

    // Method to remove an item from the item list. Replace 'Item' with your model name.
    removeItem(item) {
      const index = this.itemList.indexOf(item);
      // Splice method is used to remove the item from array.
      this.itemList.splice(index, 1);
    },
  },
});
