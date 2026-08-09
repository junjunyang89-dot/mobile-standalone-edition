<template>
  <div class="api-testing-page">
    <ApiTestingPanel variant="page" />
  </div>
</template>

<script setup lang="ts">
import ApiTestingPanel from '@/components/api-testing/ApiTestingPanel.vue'
</script>

<style scoped>
.api-testing-page {
  padding: 16px 20px 24px;
  min-height: 100%;
  background: var(--app-main-bg);
}
</style>
