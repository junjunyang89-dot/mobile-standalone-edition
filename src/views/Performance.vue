<template>
  <div class="performance">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <span>性能监控</span>
          </template>
          <div ref="chartContainer" style="width: 100%; height: 400px;"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

const chartContainer = ref<HTMLDivElement>()
let chartInstance: echarts.ECharts | null = null

onMounted(() => {
  if (chartContainer.value) {
    chartInstance = echarts.init(chartContainer.value)
    updateChart()
  }
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
  }
})

const updateChart = () => {
  if (!chartInstance) return

  const option: EChartsOption = {
    title: {
      text: '性能监控数据'
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['CPU使用率', '内存使用率', 'FPS']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: []
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: 'CPU使用率',
        type: 'line',
        data: [],
        smooth: true
      },
      {
        name: '内存使用率',
        type: 'line',
        data: [],
        smooth: true
      },
      {
        name: 'FPS',
        type: 'line',
        data: [],
        smooth: true
      }
    ]
  }

  // 模拟数据
  const now = Date.now()
  const xData: string[] = []
  const cpuData: number[] = []
  const memData: number[] = []
  const fpsData: number[] = []

  for (let i = 19; i >= 0; i--) {
    xData.push(new Date(now - i * 1000).toLocaleTimeString())
    cpuData.push(Math.random() * 100)
    memData.push(Math.random() * 100)
    fpsData.push(30 + Math.random() * 30)
  }

  option.xAxis!.data = xData
  option.series![0].data = cpuData
  option.series![1].data = memData
  option.series![2].data = fpsData

  chartInstance.setOption(option)
}
</script>

<style scoped>
.performance {
  width: 100%;
}
</style>
