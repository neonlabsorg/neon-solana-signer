<template>
  <div :class="['w-full', className]">
    <div class="flex border-b border-gray-200" role="tablist">
      <button
        v-for="(tab, index) in tabs"
        :key="index"
        @click="handleTabClick(index)"
        type="button"
        role="tab"
        :aria-selected="activeTab === index"
        :aria-controls="'tab-panel-' + index"
        :disabled="tab.disabled"
        :class="[
          'px-4 py-2 font-bold transition-colors duration-200',
          tab.disabled ? 'text-gray-100 cursor-not-allowed' :
          activeTab === index ? 'text-[#f414e6] border-b-2 border-gray-200 -mb-px' : 'text-gray-100 hover:text-[#f414e6]'
        ]"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      v-for="(tab, index) in tabs"
      :key="index"
      role="tabpanel"
      :id="'tab-panel-' + index"
      :class="['py-4', activeTab === index ? 'block' : 'hidden']"
    >
      <keep-alive>
        <component :is="tab.content" v-if="activeTab === index" />
      </keep-alive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Tab {
  label: string;
  content: object;
  disabled?: boolean;
}

const props = defineProps<{
  tabs: Tab[];
  defaultTab?: number;
  className?: string;
}>();

const activeTab = ref<number | undefined>(props.defaultTab);

const handleTabClick = (index: number) => {
  const tab = props.tabs[index];
  if (!tab.disabled) {
    activeTab.value = index;
  }
};
</script>
