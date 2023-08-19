package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func main() {

	var targetPath string

	if len(os.Args) < 2 {
		targetPath = "."
	} else {
		targetPath = os.Args[1]
		targetPath = strings.ReplaceAll(targetPath, `\`, "/")
	}
	fmt.Printf("Processing %s", targetPath)

	pdfFiles, err := filepath.Glob(filepath.Join(targetPath, "*.pdf"))
	if err != nil {
		panic(err)
	}

	for _, pdfFile := range pdfFiles {
		actual_path := strings.ReplaceAll(pdfFile, `(&&)_(&)`, "/")

		newPath := filepath.Join(targetPath, actual_path)

		err := os.MkdirAll(filepath.Dir(newPath), os.ModePerm)
		if err != nil {
			panic(err)
		}

		err = os.Rename(pdfFile, newPath)
		if err != nil {
			panic(err)
		}
	}

	allFiles := make([]string, 0)
	filepath.Walk(targetPath, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.ToLower(filepath.Ext(path)) == ".pdf" {
			path = strings.ReplaceAll(path, `\`, "/")

			path = strings.TrimPrefix(path, targetPath)
			path = strings.TrimLeft(path, "/")

			path = strings.ReplaceAll(path, "//", "/")

			allFiles = append(allFiles, path)
		}
		return nil
	})

	file, err := os.OpenFile("progress.txt", os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		panic(err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetEscapeHTML(false)

	encoder.SetEscapeHTML(false)

	if err := encoder.Encode(allFiles); err != nil {
		fmt.Println("Failed to encode to JSON:", err)
		return
	}
}
