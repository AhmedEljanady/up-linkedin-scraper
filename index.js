// const fs = require("fs");
const express = require("express");
const cors = require("cors");
const Exceljs = require("exceljs");
require("dotenv").config();

const puppeteer = require("puppeteer");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  console.log(`req received`);
  res.send("hello to scraping server!");
});

app.get("/scrape", (req, res) => {
  try {
    console.log(`req received`);

    const { url, cookies } = req.query;

    // console.log(`URL: ${url} *** cookies: ${JSON.parse(cookies)}`);

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    const scrapeInfiniteScrollItems = async (page) => {
      console.log(`scrolling...`);
      let i = 0;
      while (true) {
        console.log(++i);
        const showMoreBtn = await page.$(
          ".scaffold-finite-scroll > div:nth-child(2) > div > button"
        );

        if (showMoreBtn) {
          try {
            await sleep(2000);
            await showMoreBtn.click({ delay: 100 });
            // showMoreBtn.click();
            await page.waitForNetworkIdle();
          } catch (err) {
            console.log(`error: ${err.message}`);
          }
        } else {
          console.log(0);
          break;
        }
      }
      console.log(`after loop`);

      //excel configuration
      const workbook = new Exceljs.Workbook();
      const worksheet = workbook.addWorksheet("Posts");
      worksheet.columns = [
        { header: "Date", key: "date", width: 10 },
        { header: "Likes", key: "likes", width: 10 },
        { header: "Comments", key: "comments", width: 10 },
        { header: "Re-posts", key: "reposts", width: 10 },
        { header: "Impressions", key: "impressions", width: 12 },
        { header: "Is Re-Post", key: "isRepost", width: 10 },
        { header: "Contain Image", key: "containImage", width: 10 },
        {
          header: "Contain Linkedin Video",
          key: "containLinkedinVideo",
          width: 10,
        },
        {
          header: "Contain External Video",
          key: "containExternalVideo",
          width: 10,
        },
        { header: "Contain Documents", key: "containDocs", width: 10 },
        { header: "Contain Article", key: "containArticle", width: 10 },
      ];

      let items = await page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll(
            ".scaffold-finite-scroll__content > ul > li"
          )
        );
        // let x = 0;
        console.log(`elements: ${elements.length}`);
        console.log(`scraping posts...`);
        return elements.map((el) => {
          const dateElement = el.querySelector(
            "span.update-components-actor__sub-description > div > span > span.visually-hidden"
          );
          let date;
          const dateTrim = dateElement ? dateElement.textContent.trim() : "";
          const firstSpaceIndex = dateTrim.indexOf(" ");
          if (firstSpaceIndex === -1) {
            // The string does not contain any spaces.
            date = dateTrim;
          } else {
            // The string contains at least one space.
            date = dateTrim.substring(0, firstSpaceIndex);
          }

          const likesElement = el.querySelector(
            ".social-details-social-counts__reactions > button > span"
          );
          const likes = likesElement
            ? parseInt(likesElement.textContent.replace(/,/g, "").trim())
            : "";

          const commentsElement = el.querySelector(
            ".social-details-social-counts__comments > button > span"
          );
          const comments = commentsElement
            ? parseInt(commentsElement.textContent.replace(/,/g, "").trim())
            : "";

          const repostsElement = el.querySelector("[aria-label*='reposts']");
          const reposts = repostsElement
            ? parseInt(repostsElement.textContent.replace(/,/g, "").trim())
            : "";

          const impressionsElement = el.querySelector(
            "div.content-analytics-entry-point > a > div > div > span > strong"
          );
          const impressions = impressionsElement
            ? parseInt(impressionsElement.textContent.replace(/,/g, "").trim())
            : "";

          const isRepost = impressions ? "No" : "Yes";

          const containImageElement = el.querySelector(
            ".update-components-image"
          );
          const containImage = containImageElement ? "Yes" : "No";

          const containLinkedinVideoElement = el.querySelector(
            ".update-components-linkedin-video"
          );
          const containLinkedinVideo = containLinkedinVideoElement
            ? "Yes"
            : "No";

          const containExternalVideoElement = el.querySelector(
            ".feed-shared-external-video"
          );
          const containExternalVideo = containExternalVideoElement
            ? "Yes"
            : "No";

          const containArticleElement = el.querySelector(
            ".update-components-article"
          );
          const containArticle = containArticleElement ? "Yes" : "No";

          const containDocsElement = el.querySelector(
            ".feed-shared-document__container"
          );
          const containDocs = containDocsElement ? "Yes" : "No";

          // const num = ++x;
          return {
            date,
            likes,
            comments,
            reposts,
            impressions,
            isRepost,
            containImage,
            containArticle,
            containExternalVideo,
            containLinkedinVideo,
            containDocs,
          };
        });
      });

      for (const item of items) {
        worksheet.addRow(item);
      }
      console.log(`items: ${items.length}`);
      const buffer = await workbook.xlsx.writeBuffer();

      return { items, buffer };
    };

    (async () => {
      const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1080, height: 1080 },
        timeout: 0,
      });
      const page = await browser.newPage();
      console.log(`browser launched...`);
      await sleep(2000);
      await page.waitForSelector("body");
      // console.log(`after wait`);
      await page.setCookie(...JSON.parse(cookies));
      // console.log(`after cookies`);

      await page.goto(url, {
        timeout: 0,
      });
      console.log(`URL opening`);
      await sleep(5000);
      // console.log(`after sleep`);
      const { items, buffer } = await scrapeInfiniteScrollItems(page);
      console.log(`finishing scraping...`);
      console.log({ items });
      await browser.close();

      // Set the response headers to download the Excel file
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=posts.xlsx");

      // Send the Excel file as the response
      res.send(buffer);
    })();
  } catch (err) {
    console.log(`Err: ${err.message}`);
  }
});

const port = 3333;
app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
