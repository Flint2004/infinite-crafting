import {ref} from 'vue'
import {defineStore} from 'pinia'
import {useLocalStorage} from "@vueuse/core";

export interface ResourceStoreEntry {
    id: string
    name_cn: string
    name_en: string
    emoji: string
    discoverer_name?: string
}

export const useResourcesStore = defineStore('resources', () => {
    const resources = useLocalStorage<ResourceStoreEntry[]>('opencraft/resources', []);
    
    function addResource(element: ResourceStoreEntry) {
        // 检查是否已存在（基于id）
        const exists = resources.value.find(r => r.id === element.id);
        if (!exists) {
            resources.value.push(element);
        }
    }
    
    function setResources(elements: ResourceStoreEntry[]) {
        resources.value = elements;
    }
    
    function clearResources() {
        resources.value = [];
    }

    return { resources, addResource, setResources, clearResources }
})
