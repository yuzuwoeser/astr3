class ChartsController < ApplicationController
  def show
    # Copy the download's public fixture into your app's config directory.
    @chart = JSON.parse(Rails.root.join("config", "chart-data.json").read)
  end
end
